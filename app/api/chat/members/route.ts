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

  const meId = (session as any)?.user?.id as string | undefined;
  const role = (session as any)?.user?.role as string | undefined;
  if (!meId) return new NextResponse("Missing session user id", { status: 400 });

  // ✅ ทำเพื่อ: เฉพาะ SUPERADMIN เท่านั้นที่เพิ่มสมาชิกได้
  if (role !== "SUPERADMIN") return new NextResponse("Forbidden", { status: 403 });

  const body = await req.json().catch(() => null);
  const projectId = String(body?.projectId || "");
  const userId = body?.userId == null ? "" : String(body.userId);
  const email = body?.email == null ? "" : String(body.email).trim().toLowerCase();

  if (!projectId) return new NextResponse("Missing projectId", { status: 400 });
  if (!userId && !email) return new NextResponse("Missing userId or email", { status: 400 });

  // ✅ ทำเพื่อ: รองรับทั้งเพิ่มด้วย userId หรือด้วย email
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, role: true } })
    : await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, role: true } });

  if (!user) return new NextResponse("User not found", { status: 404 });

  // ✅ ทำเพื่อ: ถ้ามี member อยู่แล้ว ให้ "reactivate" แทนการสร้างใหม่
  const existing = await prisma.chatGroupMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    select: { id: true, isActive: true },
  });

  if (existing) {
    const updated = await prisma.chatGroupMember.update({
      where: { id: existing.id },
      data: { isActive: true },
      include: { user: { select: { id: true, email: true, name: true, role: true } } },
    });

    return NextResponse.json({
      ok: true,
      member: {
        memberId: updated.id,
        userId: updated.user.id,
        email: updated.user.email,
        name: updated.user.name,
        role: updated.user.role ?? "USER",
        isActive: updated.isActive,
        createdAt: updated.createdAt.toISOString(),
      },
      reactivated: true,
    });
  }

  const created = await prisma.chatGroupMember.create({
    data: { projectId, userId: user.id, isActive: true },
    include: { user: { select: { id: true, email: true, name: true, role: true } } },
  });

  return NextResponse.json({
    ok: true,
    member: {
      memberId: created.id,
      userId: created.user.id,
      email: created.user.email,
      name: created.user.name,
      role: created.user.role ?? "USER",
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
    },
    reactivated: false,
  });
}
