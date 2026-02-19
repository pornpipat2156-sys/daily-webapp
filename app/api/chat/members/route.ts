// app/api/chat/members/route.ts
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

  const meId = (session as any)?.user?.id as string | undefined;
  const role = (session as any)?.user?.role as string | undefined;
  if (!meId) return new NextResponse("Missing session user id", { status: 400 });

  // ✅ ทำเพื่อ: คนที่โดน disable แล้ว ห้ามดูรายชื่อสมาชิก (ยกเว้น SuperAdmin)
  const meMember = await prisma.chatGroupMember.findUnique({
    where: { projectId_userId: { projectId, userId: meId } },
    select: { id: true, isActive: true },
  });

  if (role !== "SUPERADMIN") {
    if (!meMember) return new NextResponse("Forbidden", { status: 403 });
    if (!meMember.isActive) return new NextResponse("Member disabled", { status: 403 });
  }

  const rows = await prisma.chatGroupMember.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, email: true, name: true, role: true } },
    },
  });

  // ✅ ทำเพื่อ: ให้ UI มี memberId ไว้ disable คนในกลุ่มได้ตรงตัว (ไม่ใช่ user.id)
  return NextResponse.json(
    rows.map((r) => ({
      memberId: r.id,
      userId: r.user.id,
      email: r.user.email,
      name: r.user.name,
      role: r.user.role ?? "USER",
      isActive: (r as any).isActive ?? true, // ถ้า migration ยังไม่ apply ในบาง env จะไม่พัง
      createdAt: r.createdAt.toISOString(),
    }))
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const role = (session as any)?.user?.role as string | undefined;
  if (role !== "SUPERADMIN") return new NextResponse("Forbidden", { status: 403 });

  const body = await req.json();
  const projectId = String(body?.projectId || "");
  const userId = String(body?.userId || "");
  if (!projectId || !userId) return new NextResponse("Missing projectId/userId", { status: 400 });

  const row = await prisma.chatGroupMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId },
    update: {}, // ถ้ามีอยู่แล้วก็ถือว่าสมาชิกอยู่แล้ว
    select: {
      id: true,
      projectId: true,
      userId: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true, role: true } },
    },
  });

  return NextResponse.json({
    memberId: row.id,
    userId: row.userId,
    email: row.user.email,
    name: row.user.name,
    role: row.user.role ?? "USER",
    isActive: true, // สำหรับ UI เดิม (ตอนนี้เราไม่ใช้ disabled แล้ว)
  });
}
