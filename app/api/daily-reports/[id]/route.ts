// app/api/daily-reports/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<Record<string, string | string[] | undefined>>;
};

function pickSupervisors(
  payload: Record<string, unknown>,
  projectMeta: unknown
): unknown[] {
  const fromPayload = payload?.supervisors;
  if (Array.isArray(fromPayload)) return fromPayload;

  const projectMetaObj =
    projectMeta && typeof projectMeta === "object" && !Array.isArray(projectMeta)
      ? (projectMeta as Record<string, unknown>)
      : null;

  const fromProjectMeta = projectMetaObj?.supervisors;
  if (Array.isArray(fromProjectMeta)) return fromProjectMeta;

  return [];
}

export async function GET(req: NextRequest, context: RouteContext) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, message: "forbidden" }, { status: 403 });
  }

  const params = await context.params;
  const rawId = params?.id;
  const reportId = Array.isArray(rawId)
    ? String(rawId[0] || "").trim()
    : String(rawId || "").trim();

  if (!reportId) {
    return NextResponse.json({ ok: false, message: "missing id" }, { status: 400 });
  }

  try {
    const report = await prisma.dailyReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        projectId: true,
        date: true,
        payload: true,
        project: {
          select: {
            name: true,
            meta: true,
          },
        },
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
                author: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json(
        { ok: false, message: "report not found" },
        { status: 404 }
      );
    }

    const payload =
      report.payload &&
      typeof report.payload === "object" &&
      !Array.isArray(report.payload)
        ? (report.payload as Record<string, unknown>)
        : {};

    const supervisors = pickSupervisors(payload, report.project.meta);

    const renderReport = {
      id: report.id,
      projectId: report.projectId,
      date: report.date.toISOString(),
      projectName: report.project.name,
      projectMeta: report.project.meta ?? null,
      ...payload,
      supervisors,
      issues: report.issues.map((it) => ({
        ...it,
        createdAt: it.createdAt.toISOString(),
        comments: it.comments.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
        })),
      })),
    };

    const mode = req.nextUrl.searchParams.get("mode");
    if (mode === "render") {
      return NextResponse.json(renderReport);
    }

    return NextResponse.json({
      ok: true,
      report: renderReport,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}