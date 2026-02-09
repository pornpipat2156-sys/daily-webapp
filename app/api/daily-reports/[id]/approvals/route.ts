// app/api/daily-reports/[id]/approvals/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

// normalize ทั่วไป
function norm(s: string) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

const [approvals, setApprovals] = useState<
  { approverName: string; approvedAt: string }[]
>([]);

async function loadApprovals(reportId: string) {
  const res = await fetch(`/api/daily-reports/${encodeURIComponent(reportId)}/approvals`, { cache: "no-store" });
  const json = await res.json().catch(() => null);
  if (res.ok && json?.ok) setApprovals(json.approvals || []);
  else setApprovals([]);
}

const approvedSet = useMemo(() => {
  return new Set((approvals || []).map((a) => norm(a.approverName)));
}, [approvals]);

function isApproved(supervisorName: string) {
  return approvedSet.has(norm(supervisorName));
}

// หลังเลือก reportId ให้เรียก
useEffect(() => {
  if (reportId) loadApprovals(reportId);
}, [reportId]);

async function onApproveMine() {
  const res = await fetch(`/api/daily-reports/${encodeURIComponent(reportId)}/approvals`, { method: "POST" });
  const json = await res.json().catch(() => null);

  // ✅ สำคัญ: 409 ก็ถือว่า “อนุมัติแล้ว” ให้รีเฟรชสถานะด้วย
  if (res.ok || res.status === 409) {
    await loadApprovals(reportId);
    return;
  }

  alert(json?.message || "ยืนยันไม่สำเร็จ");
}


// normalize ชื่อคน (เพิ่ม: ตัดคำนำหน้า/ตำแหน่งทางวิชาการ/ลบจุด)
function normPersonName(s: string) {
  let t = String(s || "").trim();

  // ลบจุด/เครื่องหมายบางอย่างที่มักทำให้ไม่ match
  t = t.replace(/[.]/g, " ");
  t = t.replace(/\s+/g, " ").trim();

  // ตัดคำนำหน้า/ตำแหน่งยอดฮิต (ไทย)
  // หมายเหตุ: ทำแบบวนหลายรอบ เพราะบางทีมีหลายคำซ้อนกัน
  const prefixes = [
    "ว่าที่",
    "พล.อ.",
    "พล.ท.",
    "พล.ต.",
    "พ.ต.อ.",
    "พ.ต.ท.",
    "พ.ต.ต.",
    "ดร",
    "ดร.",
    "ผศ",
    "ผศ.",
    "รศ",
    "รศ.",
    "ศ",
    "ศ.",
    "คุณ",
    "นาย",
    "นาง",
    "นางสาว",
    "น.ส.",
    "นส.",
    "mr",
    "mr.",
    "ms",
    "ms.",
    "mrs",
    "mrs.",
  ];

  const stripOnce = (x: string) => {
    const xNorm = x.trim();
    for (const p of prefixes) {
      const re = new RegExp(`^${p}\\s+`, "i");
      if (re.test(xNorm)) return xNorm.replace(re, "").trim();
    }
    return xNorm;
  };

  // วนตัดหลายครั้ง
  for (let i = 0; i < 5; i++) {
    const next = stripOnce(t);
    if (next === t) break;
    t = next;
  }

  // จัดช่องว่างอีกที + lower (ภาษาไทยไม่เปลี่ยน แต่กันเคสอังกฤษ)
  return norm(t);
}

function normalizeSupervisors(raw: any): { name: string; role: string }[] {
  const arr = Array.isArray(raw) ? raw : [];
  const looksLikeRole = (s: string) => /(ผู้|หัวหน้า|ผอ|วิศวกร|ผู้ตรวจ|ผู้ควบคุม|ผู้แทน)/.test(s);

  return arr
    .map((x: any) => {
      // แบบใหม่: {name, role}
      if (x && typeof x === "object") {
        return { name: String(x?.name || "").trim(), role: String(x?.role || "").trim() };
      }

      // แบบเดิม: string
      const s = String(x || "").trim();
      if (!s) return { name: "", role: "" };

      // ถ้าดูเหมือน role ให้ใส่ role แต่ name ว่าง
      return looksLikeRole(s) ? { name: "", role: s } : { name: s, role: "" };
    })
    // สำหรับ approval ต้องมีชื่อเท่านั้น
    .filter((x) => x.name);
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
 * ผู้ควบคุมงาน "ยืนยันของฉัน"
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

    // ✅ ดึงชื่อจาก DB (ชัวร์สุด)
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true, role: true },
    });

    const meDisplay = String(dbUser?.name || "").trim();
    const meEmail = String(dbUser?.email || user.email || "").trim();

    // ถ้าไม่มี name จริง ๆ อย่างน้อยต้องมี email
    const meName = meDisplay || meEmail;
    if (!meName) {
      return NextResponse.json({ ok: false, message: "user has no display name" }, { status: 400 });
    }

    // ทำ key หลายแบบเพื่อ match ง่ายขึ้น
    const meKeyA = norm(meName); // แบบเดิม
    const meKeyB = normPersonName(meName); // ตัดคำนำหน้า

    // หา supervisor ที่ match
    const mySupervisor =
      supervisors.find((s) => norm(s.name) === meKeyA) ||
      supervisors.find((s) => normPersonName(s.name) === meKeyB) ||
      supervisors.find((s) => normPersonName(s.name) === meKeyA) ||
      supervisors.find((s) => norm(s.name) === meKeyB);

    // ✅ SUPERADMIN bypass (แต่ยังพยายาม match ก่อน)
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
