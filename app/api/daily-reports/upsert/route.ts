import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function bangkokStart(dateYmd: string) {
  return new Date(`${dateYmd}T00:00:00.000+07:00`);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const projectId = String(body?.projectId || "");
    const dateYmd = String(body?.date || ""); // expect YYYY-MM-DD

    if (!projectId || !/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
      return NextResponse.json({ ok: false, message: "projectId/date(YYYY-MM-DD) required" }, { status: 400 });
    }

    const date = bangkokStart(dateYmd);

    // แยก issues ออกมาจาก payload ที่จะเก็บลง report
    const incomingIssues = Array.isArray(body?.issues) ? body.issues : [];

    // เก็บ payload ฟอร์มทั้งหมดลง DailyReport.payload (ไม่รวม issues เพื่อกันซ้ำ)
    const payload = { ...body, issues: undefined };

    const saved = await prisma.dailyReport.upsert({
      where: { projectId_date: { projectId, date } },
      create: { projectId, date, payload },
      update: { payload },
      select: { id: true, projectId: true, date: true },
    });

    const reportId = saved.id;

    // ---- sync issues (ไม่ทำ comment หาย) ----
    const existing = await prisma.issue.findMany({
      where: { reportId },
      select: { id: true, comments: { select: { id: true } } },
    });

    const incomingClean = incomingIssues
      .map((x: any) => ({
        id: x?.id ? String(x.id) : "",
        detail: String(x?.detail || "").trim(),
        imageUrl: String(x?.imageDataUrl || x?.imageUrl || "").trim(),
      }))
      .filter((x: any) => x.detail || x.imageUrl); // เอาเฉพาะที่มีข้อมูลจริง

    const incomingIds = new Set(incomingClean.filter((x: any) => x.id).map((x: any) => x.id));

    // update/create
    for (const it of incomingClean) {
      const isExisting = it.id && existing.some((e) => e.id === it.id);

      if (isExisting) {
        await prisma.issue.update({
          where: { id: it.id },
          data: { detail: it.detail || "-", imageUrl: it.imageUrl || null },
        });
      } else {
        await prisma.issue.create({
          data: {
            reportId,
            detail: it.detail || "-",
            imageUrl: it.imageUrl || null,
          },
        });
      }
    }

    // delete removed (only those WITHOUT comments)
    for (const ex of existing) {
      if (!incomingIds.has(ex.id)) {
        const hasComments = (ex.comments || []).length > 0;
        if (!hasComments) {
          await prisma.issue.delete({ where: { id: ex.id } });
        } else {
          // ถ้ามีคอมเมนต์แล้ว ไม่ลบทิ้ง (กันประวัติหาย) — เคลียร์รูป/ข้อความแทน
          await prisma.issue.update({
            where: { id: ex.id },
            data: { detail: "(รายการนี้ถูกลบ/แก้ไขโดยผู้กรอก)", imageUrl: null },
          });
        }
      }
    }

    return NextResponse.json({ ok: true, reportId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "upsert failed" }, { status: 500 });
  }
}
