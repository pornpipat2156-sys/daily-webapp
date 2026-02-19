import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function DELETE(_: Request, { params }: { params: { memberId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const role = (session as any)?.user?.role as string | undefined;
  if (role !== "SUPERADMIN") return new NextResponse("Forbidden", { status: 403 });

  const memberId = params.memberId;
  if (!memberId) return new NextResponse("Missing memberId", { status: 400 });

  await prisma.chatGroupMember.delete({ where: { id: memberId } });

  return NextResponse.json({ ok: true });
}
