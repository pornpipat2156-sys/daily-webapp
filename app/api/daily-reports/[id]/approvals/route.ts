// app/api/daily-reports/[id]/approvals/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// ✅ Next.js App Router: ctx.params เป็น object ไม่ใช่ Promise
type Ctx = { params: { id: string } };

function norm(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeSupervisors(raw: any): { name: string; role: string }[] {
  const arr = Array.isArray(raw) ? raw : [];
  const looksLikeRole = (s: string) =>
    /(ผู้|หัวหน้า|ผอ|วิศวกร|ผู้ตรวจ|ผู้ควบคุม|ผู้แทน)/.test(s);

  return arr
    .map((x: any) => {
      if (x && typeof x === "object") {
        return { name: String(x?.name || "").trim(), role: String(x?.role || "").trim() };
      }
      const s = String(x || "").trim();
      if (!s) return { name: "", role: "" };
      return looksLikeRole(s) ? { name: "", role: s } : { name: s, role: "" };
    })
    .filter((x) => x.name); // ต้องมีชื่อเพื่อ match
}

/**
 * GET /api/daily-reports/[id]/approvals
 * ดึงสถานะการอนุมัติทั้งหมดของรายงาน
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const reportId = String(ctx.params?.id || "").trim();

  if (!reportId) {
    return NextResponse.json({ ok: false, message: "missing report id" }, { status: 400 });
  }

  try {
    const approvals = await prisma.reportApproval.findMany({
      where: { reportId },
      orderBy: { approvedAt: "asc" },
      select: {
        id: true,
        approverName: true,
        approverRole: true,
        approverUserId: true,
        approvedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      approvals: approvals.map((a) => ({
        ...a,
        approvedAt: a.approvedAt.toISOString(),
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? "internal error" }, { status: 500 });
  }
}

/**
 * POST /api/daily-reports/[id]/approvals
 * ผู้ควบคุมงาน "ยืนยันของฉัน"
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const reportId = String(ctx.params?.id || "").trim();

  if (!reportId) {
    return NextResponse.json({ ok: false, message: "missing report id" }, { status: 400 });
  }

  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  try {
    const report = await prisma.dailyReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        projectId: true,
        date: true,
        project: { select: { name: true, meta: true } },
      },
    });

    if (!report) {
      return NextResponse.json({ ok: false, message: "report not found" }, { status: 404 });
    }

    const supervisors = normalizeSupervisors((report.project?.meta as any)?.supervisors);
    if (supervisors.length === 0) {
      return NextResponse.json({ ok: false, message: "project has no supervisors in DB" }, { status: 400 });
    }

    // ✅ ดึงชื่อจริงจาก DB เพื่อเอาไป match
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true },
    });

    const meName = String(dbUser?.name || dbUser?.email || user.email || "").trim();
    if (!meName) {
      return NextResponse.json({ ok: false, message: "user has no display name" }, { status: 400 });
    }

    const mySupervisor = supervisors.find((s) => norm(s.name) === norm(meName));
    if (!mySupervisor) {
      return NextResponse.json({ ok: false, message: "คุณไม่ใช่ผู้ควบคุมงานของโครงการนี้" }, { status: 403 });
    }

    const exists = await prisma.reportApproval.findFirst({
      where: { reportId, approverName: mySupervisor.name },
      select: { id: true },
    });

    if (exists) {
      return NextResponse.json({ ok: false, message: "คุณได้ยืนยันไปแล้ว" }, { status: 409 });
    }

    const approval = await prisma.reportApproval.create({
      data: {
        reportId,
        approverName: mySupervisor.name,
        approverRole: mySupervisor.role || null,
        approverUserId: user.id,
      },
    });

    return NextResponse.json({
      ok: true,
      approvalId: approval.id,
      projectName: report.project?.name || "",
      date: report.date.toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? "internal error" }, { status: 500 });
  }
}
