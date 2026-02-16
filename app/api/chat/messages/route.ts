// app/api/chat/messages/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) return new NextResponse("Missing projectId", { status: 400 });

  // ตรวจว่า user เป็นสมาชิกกลุ่มหรือเป็น SUPERADMIN
  const meId = (session as any)?.user?.id as string | undefined;
  const role = (session as any)?.user?.role as string | undefined;

  if (!meId) return new NextResponse("Missing session user id", { status: 400 });

  const isMember = await prisma.chatGroupMember.findUnique({
    where: { projectId_userId: { projectId, userId: meId } },
    select: { id: true },
  });

  if (!isMember && role !== "SUPERADMIN") return new NextResponse("Forbidden", { status: 403 });

  const rows = await prisma.chatMessage.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: {
      author: { select: { id: true, email: true, name: true, role: true } },
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
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const meId = (session as any)?.user?.id as string | undefined;
  const role = (session as any)?.user?.role as string | undefined;
  if (!meId) return new NextResponse("Missing session user id", { status: 400 });

  const body = await req.json();
  const projectId = String(body?.projectId || "");
  const text = body?.text == null ? null : String(body.text);
  const reportId = body?.reportId == null ? null : String(body.reportId);
  const mentionUserIds = Array.isArray(body?.mentionUserIds) ? body.mentionUserIds.map(String) : [];

  if (!projectId) return new NextResponse("Missing projectId", { status: 400 });
  if (!text && !reportId) return new NextResponse("Nothing to send", { status: 400 });

  const isMember = await prisma.chatGroupMember.findUnique({
    where: { projectId_userId: { projectId, userId: meId } },
    select: { id: true },
  });

  if (!isMember && role !== "SUPERADMIN") return new NextResponse("Forbidden", { status: 403 });

  const created = await prisma.chatMessage.create({
    data: {
      projectId,
      authorId: meId,
      text,
      reportId,
      mentionUserIds,
    },
    include: {
      author: { select: { id: true, email: true, name: true, role: true } },
    },
  });

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
