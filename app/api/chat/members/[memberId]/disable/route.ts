// app/api/chat/members/[memberId]/disable/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _req: Request,
  context: { params: Promise<{ memberId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const meId = (session as any)?.user?.id as string | undefined;
  const role = (session as any)?.user?.role as string | undefined;
  if (!meId) return new NextResponse("Missing session user id", { status: 400 });

  // ✅ ทำเพื่อ: เฉพาะ SUPERADMIN เท่านั้นที่ disable สมาชิกได้
  if (role !== "SUPERADMIN") return new NextResponse("Forbidden", { status: 403 });

  const { memberId } = await context.params; // ✅ สำคัญ: await เพราะเป็น Promise
  if (!memberId) return new NextResponse("Missing memberId", { status: 400 });

  const updated = await prisma.chatGroupMember.update({
    where: { id: memberId },
    data: { isActive: false },
    include: { user: { select: { id: true, email: true, name: true, role: true } } },
  });

  return NextResponse.json({
    ok: true,
    memberId: updated.id,
    userId: updated.userId,
    isActive: updated.isActive,
  });
}
