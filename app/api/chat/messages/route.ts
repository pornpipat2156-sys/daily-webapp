import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";
import { sendChatMessagePush, sendDedupedPushes } from "@/lib/webpush";

type MemberLite = {
  userId: string;
  email: string;
  name: string | null;
};

async function requireAuth() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return {
      ok: false as const,
      res: new NextResponse("Unauthorized", { status: 401 }),
    };
  }

  const meId = (session as any)?.user?.id as string | undefined;
  const role = (session as any)?.user?.role as string | undefined;

  if (!meId) {
    return {
      ok: false as const,
      res: new NextResponse("Missing session user id", { status: 400 }),
    };
  }

  return { ok: true as const, session, meId, role };
}

async function requireMemberOrSuperAdmin(projectId: string, meId: string, role?: string) {
  const isMember = await prisma.chatGroupMember.findUnique({
    where: { projectId_userId: { projectId, userId: meId } },
    select: { id: true, isActive: true },
  });

  if (role === "SUPERADMIN") return { ok: true as const };

  if (!isMember) {
    return {
      ok: false as const,
      res: new NextResponse("Forbidden", { status: 403 }),
    };
  }

  if (!isMember.isActive) {
    return {
      ok: false as const,
      res: new NextResponse("Member disabled", { status: 403 }),
    };
  }

  return { ok: true as const };
}

function normalizeText(s: string) {
  return String(s || "").toLowerCase();
}

function hasMentionToken(text: string, token: string) {
  const hay = normalizeText(text);
  const needle = normalizeText(token).trim();
  if (!needle) return false;

  let start = 0;

  while (true) {
    const idx = hay.indexOf(needle, start);
    if (idx === -1) return false;

    const prev = idx === 0 ? " " : hay[idx - 1];
    const next = hay[idx + needle.length] ?? " ";

    const prevOk = /\s|[([{"'`>]/.test(prev);
    const nextOk = /\s|[)\]}",.!?:;'"`<]/.test(next);

    if (prevOk && nextOk) return true;
    start = idx + needle.length;
  }
}

function extractMentionUserIds(text: string | null, members: MemberLite[], authorId: string) {
  if (!text?.trim()) return [];

  const matches = new Set<string>();

  const candidates = members
    .map((m) => {
      const display = m.name?.trim() ? m.name.trim() : m.email.trim();
      return {
        userId: m.userId,
        tokens: [`@${display}`, `@${m.email.trim()}`],
      };
    })
    .sort((a, b) => {
      const aLen = Math.max(...a.tokens.map((t) => t.length));
      const bLen = Math.max(...b.tokens.map((t) => t.length));
      return bLen - aLen;
    });

  for (const c of candidates) {
    if (c.userId === authorId) continue;
    const hit = c.tokens.some((token) => hasMentionToken(text, token));
    if (hit) matches.add(c.userId);
  }

  return Array.from(matches);
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");

  if (!projectId) {
    return new NextResponse("Missing projectId", { status: 400 });
  }

  const perm = await requireMemberOrSuperAdmin(projectId, auth.meId, auth.role);
  if (!perm.ok) return perm.res;

  const rows = await prisma.chatMessage.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: {
      author: {
        select: { id: true, email: true, name: true, role: true },
      },
    },
  });

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      author: r.author,
      text: r.text,
      createdAt: r.createdAt.toISOString(),
      reportId: r.reportId,
      mentionUserIds: r.mentionUserIds ?? [],
    }))
  );
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const body = await req.json();

  const projectId = String(body?.projectId || "");
  const text = body?.text == null ? null : String(body.text);
  const reportId = body?.reportId == null ? null : String(body.reportId);

  if (!projectId) {
    return new NextResponse("Missing projectId", { status: 400 });
  }

  if (!text && !reportId) {
    return new NextResponse("Nothing to send", { status: 400 });
  }

  const perm = await requireMemberOrSuperAdmin(projectId, auth.meId, auth.role);
  if (!perm.ok) return perm.res;

  const members = await prisma.chatGroupMember.findMany({
    where: {
      projectId,
      isActive: true,
    },
    select: {
      userId: true,
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  const mentionUserIds = extractMentionUserIds(
    text,
    members.map((m) => ({
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
    })),
    auth.meId
  );

  const created = await prisma.chatMessage.create({
    data: {
      projectId,
      authorId: auth.meId,
      text,
      reportId,
      mentionUserIds,
    },
    include: {
      author: {
        select: { id: true, email: true, name: true, role: true },
      },
      project: {
        select: { id: true, name: true },
      },
    },
  });

  try {
    const activeMembers = await prisma.chatGroupMember.findMany({
      where: {
        projectId,
        isActive: true,
        userId: { not: auth.meId },
      },
      select: { userId: true },
    });

    const allRecipientIds = activeMembers.map((m) => m.userId).filter(Boolean);
    const mentionRecipientIds = mentionUserIds;
    const generalRecipientIds = allRecipientIds.filter((id) => !mentionRecipientIds.includes(id));

    const authorName = created.author.name?.trim() || created.author.email;
    const projectName = created.project?.name || "โครงการ";
    const preview = String(created.text || "").trim() || "คุณมีข้อความใหม่ในแชตโครงการ";

    if (mentionRecipientIds.length > 0) {
      await createNotifications(
        mentionRecipientIds.map((userId) => ({
          userId,
          type: "MENTION",
          title: `มีคน mention คุณใน ${projectName}`,
          body: `${authorName}: ${preview}`,
          url: `/contact?projectId=${encodeURIComponent(projectId)}`,
          sourceKey: `mention:${created.id}:${userId}`,
          groupKey: `mention:${projectId}`,
          projectId,
          meta: {
            projectId,
            messageId: created.id,
            authorId: created.author.id,
            kind: "mention",
          },
        }))
      );

      await sendDedupedPushes(
        mentionRecipientIds.map((userId) => ({
          userId,
          dedupeKey: `mention:${created.id}:${userId}`,
          channel: "mention",
          payload: {
            title: `มีคน mention คุณใน ${projectName}`,
            body: `${authorName}: ${preview}`,
            url: `/contact?projectId=${encodeURIComponent(projectId)}`,
            tag: `mention:${created.id}`,
            data: {
              projectId,
              messageId: created.id,
              kind: "mention",
            },
          },
        }))
      );
    }

    if (generalRecipientIds.length > 0) {
      await sendChatMessagePush({
        recipientUserIds: generalRecipientIds,
        projectName,
        authorName,
        messageText: created.text,
        projectId,
      });
    }
  } catch (err) {
    console.error("chat notify failed:", err);
  }

  return NextResponse.json({
    id: created.id,
    projectId: created.projectId,
    author: created.author,
    text: created.text,
    createdAt: created.createdAt.toISOString(),
    reportId: created.reportId,
    mentionUserIds: created.mentionUserIds ?? [],
  });
}