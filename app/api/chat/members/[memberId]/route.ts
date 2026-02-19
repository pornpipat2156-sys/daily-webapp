// app/api/chat/members/[memberId]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/chat/members/[memberId]
 * ทำเพื่ออะไร:
 * - ให้ SuperAdmin "Remove member" ออกจากกลุ่มจริง
 * - เป็นพื้นฐานให้ UI ทำปุ่ม Remove ได้ง่ายและชัดเจน
 */
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ memberId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const role = (session as any)?.user?.role as string | undefined;
  if (role !== "SUPERADMIN") return new NextResponse("Forbidden", { status: 403 });

  const { memberId } = await context.params;
  if (!memberId) return new NextResponse("Missing memberId", { status: 400 });

  // ลบสมาชิกออกจากกลุ่มจริง
  await prisma.chatGroupMember.delete({ where: { id: memberId } });

  return NextResponse.json({ ok: true });
}

/**
 * (Optional) PATCH /api/chat/members/[memberId]
 * ถ้าคุณอยากใช้ endpoint เดียวสำหรับ enable/disable ด้วย
 * - body: { isActive: boolean }
 *
 * ถ้าคุณแยก /enable และ /disable แล้ว ให้ลบทิ้งได้
 */
export async function PATCH(
  req: Request,
  context: { params: Promise<{ memberId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const role = (session as any)?.user?.role as string | undefined;
  if (role !== "SUPERADMIN") return new NextResponse("Forbidden", { status: 403 });

  const { memberId } = await context.params;
  if (!memberId) return new NextResponse("Missing memberId", { status: 400 });

  const body = await req.json().catch(() => ({}));
  const isActive = Boolean(body?.isActive);

  const updated = await prisma.chatGroupMember.update({
    where: { id: memberId },
    data: { isActive },
    include: { user: { select: { id: true, email: true, name: true, role: true } } },
  });

  return NextResponse.json({
    ok: true,
    member: {
      memberId: updated.id,
      userId: updated.userId,
      email: updated.user.email,
      name: updated.user.name,
      role: updated.user.role ?? "USER",
      isActive: updated.isActive,
    },
  });
}
