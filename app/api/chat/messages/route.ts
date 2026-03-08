// app/api/chat/messages/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { sendChatMessagePush } from "@/lib/webpush";

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

  // ตอนนี้ยังไม่ให้ client ส่ง mentionUserIds ตรง ๆ
  const mentionUserIds: string[] = [];

  if (!projectId) {
    return new NextResponse("Missing projectId", { status: 400 });
  }

  if (!text && !reportId) {
    return new NextResponse("Nothing to send", { status: 400 });
  }

  const perm = await requireMemberOrSuperAdmin(projectId, auth.meId, auth.role);
  if (!perm.ok) return perm.res;

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
    },
  });

  try {
    const [project, members] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true },
      }),
      prisma.chatGroupMember.findMany({
        where: {
          projectId,
          isActive: true,
          userId: { not: auth.meId },
        },
        select: {
          userId: true,
        },
      }),
    ]);

    const recipientUserIds = members.map((m) => m.userId).filter(Boolean);

    if (recipientUserIds.length > 0) {
      await sendChatMessagePush({
        recipientUserIds,
        projectName: project?.name || "โครงการ",
        authorName: created.author.name?.trim() || created.author.email,
        messageText: created.text,
        projectId,
      });
    }
  } catch (err) {
    console.error("chat push notify failed:", err);
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