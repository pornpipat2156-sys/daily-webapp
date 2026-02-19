// app/api/chat/members/[memberId]/enable/route.ts
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

  const role = (session as any)?.user?.role as string | undefined;
  if (role !== "SUPERADMIN") return new NextResponse("Forbidden", { status: 403 });

  const { memberId } = await context.params;
  if (!memberId) return new NextResponse("Missing memberId", { status: 400 });

  const updated = await prisma.chatGroupMember.update({
    where: { id: memberId },
    data: { isActive: true },
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
