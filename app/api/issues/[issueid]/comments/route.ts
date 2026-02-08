// app/api/issues/[issueId]/comments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ issueId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { issueId } = await ctx.params;
  if (!issueId) return NextResponse.json({ ok: false, message: "missing issueId" }, { status: 400 });

  const list = await prisma.issueComment.findMany({
    where: { issueId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      comment: true,
      createdAt: true,
      author: { select: { id: true, email: true, name: true, role: true } },
    },
  });

  return NextResponse.json({ ok: true, comments: list });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ ok: false, message: "forbidden" }, { status: 403 });

  const { issueId } = await ctx.params;
  if (!issueId) return NextResponse.json({ ok: false, message: "missing issueId" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const comment = String(body?.comment || "").trim();
  if (!comment) return NextResponse.json({ ok: false, message: "missing comment" }, { status: 400 });

  // ✅ check ว่าผู้ใช้มีสิทธิ์คอมเมนต์ issue นี้ไหม:
  // - SUPERADMIN/ADMIN ผ่านเลย
  // - USER ผ่านเฉพาะถ้าเป็น ProjectAdmin ของ project ที่ issue อยู่
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { report: { select: { projectId: true } } },
  });
  const projectId = issue?.report?.projectId;
  if (!projectId) return NextResponse.json({ ok: false, message: "issue not found" }, { status: 404 });

  const role = user.role;

  if (role !== "SUPERADMIN" && role !== "ADMIN") {
    const link = await prisma.projectAdmin.findFirst({
      where: { projectId, userId: user.id, isActive: true },
      select: { id: true },
    });
    if (!link) return NextResponse.json({ ok: false, message: "forbidden" }, { status: 403 });
  }

  const row = await prisma.issueComment.create({
    data: { issueId, authorId: user.id, comment },
    select: { id: true, comment: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, row });
}
