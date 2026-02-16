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

  const isMember = await prisma.chatGroupMember.findUnique({
    where: { projectId_userId: { projectId, userId: meId } },
    select: { id: true },
  });

  if (!isMember && role !== "SUPERADMIN") return new NextResponse("Forbidden", { status: 403 });

  const rows = await prisma.chatGroupMember.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, email: true, name: true, role: true } },
    },
  });

  return NextResponse.json(
    rows.map((r) => ({
      id: r.user.id,
      email: r.user.email,
      name: r.user.name,
      role: r.user.role ?? "USER",
    }))
  );
}
