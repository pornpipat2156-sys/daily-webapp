// app/api/chat/members/add/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const role = (session as any)?.user?.role as string | undefined;
  if (role !== "SUPERADMIN") return new NextResponse("Forbidden: SUPERADMIN only", { status: 403 });

  const body = await req.json();
  const projectId = String(body?.projectId || "");
  const userIds: string[] = Array.isArray(body?.userIds) ? body.userIds.map(String) : [];

  if (!projectId) return new NextResponse("Missing projectId", { status: 400 });
  if (!userIds.length) return new NextResponse("Missing userIds", { status: 400 });

  // upsert membership (many)
  await prisma.$transaction(
    userIds.map((userId) =>
      prisma.chatGroupMember.upsert({
        where: { projectId_userId: { projectId, userId } },
        create: { projectId, userId },
        update: {},
      })
    )
  );

  return NextResponse.json({ ok: true, added: userIds.length });
}
