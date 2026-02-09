// app/api/daily-reports/[id]/approvals/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

// Next.js 16: params เป็น Promise
type Ctx = { params: Promise<{ id: string }> };

function norm(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// ตัดคำนำหน้าชื่อไทย/สัญลักษณ์ เพื่อช่วย match
function normPersonName(s: string) {
  let t = String(s || "").trim();

  // ตัดคำนำหน้าที่พบบ่อย
  t = t.replace(
    /^(นาย|นางสาว|น\.ส\.|นส\.|นาง|ดร\.|ผศ\.|รศ\.|ศ\.|mr\.|mrs\.|ms\.)\s*/i,
    ""
  );

  // ลบวงเล็บ/จุด/ขีด/คอมม่า ที่ชอบทำให้ match ไม่ติด
  t = t.replace(/[().,_-]/g, " ");

  return norm(t);
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
  const { id } = await ctx.params;
  const reportId = String(id || "").trim();

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
 * ผู้ควบคุมงาน "ยืนยันของฉัน" (SUPERADMIN bypass ตาม Webapp11)
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const reportId = String(id || "").trim();

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

    // ✅ ดึงชื่อ+role จาก DB เพื่อ match และทำ SUPERADMIN bypass
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true, role: true },
    });

    const meDisplay = String(dbUser?.name || "").trim();
    const meEmail = String(dbUser?.email || user.email || "").trim();
    const meName = meDisplay || meEmail;

    if (!meName) {
      return NextResponse.json({ ok: false, message: "user has no display name" }, { status: 400 });
    }

    const meKeyA = norm(meName);
    const meKeyB = normPersonName(meName);

    const mySupervisor =
      supervisors.find((s) => norm(s.name) === meKeyA) ||
      supervisors.find((s) => normPersonName(s.name) === meKeyB) ||
      supervisors.find((s) => normPersonName(s.name) === meKeyA) ||
      supervisors.find((s) => norm(s.name) === meKeyB);

    // ✅ SUPERADMIN bypass (แต่ยังพยายาม match ก่อน) ตาม Webapp11
    const isSuperAdmin = String(dbUser?.role || "").toUpperCase() === "SUPERADMIN";
    if (!mySupervisor && !isSuperAdmin) {
      return NextResponse.json({ ok: false, message: "คุณไม่ใช่ผู้ควบคุมงานของโครงการนี้" }, { status: 403 });
    }

    // ถ้า match supervisor ได้ -> ใช้ชื่อ supervisor ตาม DB
    // ถ้า superadmin แต่ไม่ match -> ใช้ชื่อจาก user
    const approverName = mySupervisor?.name || meName;
    const approverRole = mySupervisor?.role || (isSuperAdmin ? "SUPERADMIN" : null);

    const exists = await prisma.reportApproval.findFirst({
      where: { reportId, approverName },
      select: { id: true },
    });

    if (exists) {
      return NextResponse.json({ ok: false, message: "คุณได้ยืนยันไปแล้ว" }, { status: 409 });
    }

    const approval = await prisma.reportApproval.create({
      data: {
        reportId,
        approverName,
        approverRole,
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
