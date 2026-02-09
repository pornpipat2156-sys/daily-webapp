// app/api/issues/[issueid]/comments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ issueid: string }> };

async function canComment(userId: string, role: string, projectId: string) {
  if (role === "SUPERADMIN") return true;
  if (role !== "ADMIN") return false;

  const pa = await prisma.projectAdmin.findFirst({
    where: { userId, projectId, isActive: true },
    select: { id: true },
  });
  return Boolean(pa);
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ ok: false, message: "forbidden" }, { status: 403 });

  const { issueid } = await ctx.params;
  if (!issueid) return NextResponse.json({ ok: false, message: "missing issueid" }, { status: 400 });

  try {
    const issue = await prisma.issue.findUnique({
      where: { id: issueid },
      select: {
        id: true,
        report: { select: { projectId: true } },
      },
    });
    if (!issue) return NextResponse.json({ ok: false, message: "issue not found" }, { status: 404 });

    const ok = await canComment(user.id, user.role, issue.report.projectId);
    if (!ok) return NextResponse.json({ ok: false, message: "forbidden" }, { status: 403 });

    const list = await prisma.issueComment.findMany({
      where: { issueId: issueid },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        comment: true,
        createdAt: true,
        author: { select: { id: true, email: true, name: true, role: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      comments: list.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ ok: false, message: "forbidden" }, { status: 403 });

  const { issueid } = await ctx.params;
  if (!issueid) return NextResponse.json({ ok: false, message: "missing issueid" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const comment = String(body?.comment || "").trim();
  if (!comment) return NextResponse.json({ ok: false, message: "missing comment" }, { status: 400 });

  try {
    const issue = await prisma.issue.findUnique({
      where: { id: issueid },
      select: {
        id: true,
        report: { select: { projectId: true } },
      },
    });
    if (!issue) return NextResponse.json({ ok: false, message: "issue not found" }, { status: 404 });

    const ok = await canComment(user.id, user.role, issue.report.projectId);
    if (!ok) return NextResponse.json({ ok: false, message: "forbidden" }, { status: 403 });

    const created = await prisma.issueComment.create({
      data: { issueId: issueid, comment, authorId: user.id },
      select: {
        id: true,
        comment: true,
        createdAt: true,
        author: { select: { id: true, email: true, name: true, role: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      comment: { ...created, createdAt: created.createdAt.toISOString() },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? "Internal server error" }, { status: 500 });
  }
}
