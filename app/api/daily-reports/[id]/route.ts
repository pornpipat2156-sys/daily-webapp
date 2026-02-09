// app/api/daily-reports/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ ok: false, message: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const reportId = String(id || "").trim();
  if (!reportId) return NextResponse.json({ ok: false, message: "missing id" }, { status: 400 });

  try {
    const report = await prisma.dailyReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        projectId: true,
        date: true,
        project: { select: { name: true, meta: true } },
        issues: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            detail: true,
            imageUrl: true,
            createdAt: true,
            comments: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                comment: true,
                createdAt: true,
                author: { select: { id: true, email: true, name: true, role: true } },
              },
            },
          },
        },
      },
    });

    if (!report) return NextResponse.json({ ok: false, message: "report not found" }, { status: 404 });

    return NextResponse.json({
      ok: true,
      report: {
        id: report.id,
        projectId: report.projectId,
        date: report.date.toISOString(),
        projectName: report.project.name,
        projectMeta: report.project.meta ?? null,
        issues: report.issues.map((it) => ({
          ...it,
          createdAt: it.createdAt.toISOString(),
          comments: it.comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
        })),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? "Internal server error" }, { status: 500 });
  }
}
