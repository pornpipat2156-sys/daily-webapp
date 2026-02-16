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
      return NextResponse.json(
        { ok: false, message: "projectId/date(YYYY-MM-DD) required" },
        { status: 400 }
      );
    }

    const date = bangkokStart(dateYmd);

    // ✅ แยก issues ออกก่อน (ห้ามใส่ undefined ลง Json)
    const incomingIssues = Array.isArray(body?.issues) ? body.issues : [];
    const { issues: _omitIssues, ...payload } = body;

    // ✅ ทำความสะอาด issue ก่อน (ใช้เก็บ snapshot + sync)
    const incomingClean = incomingIssues
      .map((x: any) => ({
        id: x?.id ? String(x.id) : "",
        detail: String(x?.detail || "").trim(),
        imageUrl: String(x?.imageDataUrl || x?.imageUrl || "").trim(),
      }))
      .filter((x: any) => x.detail || x.imageUrl); // เอาเฉพาะที่มีข้อมูลจริง

    // ✅ 1) หา report เดิมก่อน เพื่อควบคุม initial snapshot
    const existingReport = await prisma.dailyReport.findUnique({
      where: { projectId_date: { projectId, date } },
      select: { id: true, initialPayload: true, initialIssues: true },
    });

    let reportId: string;

    if (!existingReport) {
      // ✅ 2) ยังไม่มี: create พร้อม initial snapshot (immutable)
      const created = await prisma.dailyReport.create({
        data: {
          projectId,
          date,
          payload,
          initialPayload: payload,
          initialIssues: incomingClean,
          initialCapturedAt: new Date(),
        },
        select: { id: true },
      });
      reportId = created.id;
    } else {
      reportId = existingReport.id;

      // ✅ 3) มีแล้ว: update payload (แก้ไขได้)
      // ✅ แต่ถ้า initial ยังว่าง (รายงานเก่าก่อนเพิ่มฟิลด์) -> ล็อกครั้งแรก "ครั้งเดียว"
      const needLockInitial =
        existingReport.initialPayload == null || existingReport.initialIssues == null;

      await prisma.dailyReport.update({
        where: { id: reportId },
        data: {
          payload,
          ...(needLockInitial
            ? {
                initialPayload: existingReport.initialPayload ?? payload,
                initialIssues: existingReport.initialIssues ?? incomingClean,
                initialCapturedAt: new Date(),
              }
            : {}),
        },
        select: { id: true },
      });
    }

    // ---- sync issues (ไม่ทำ comment หาย) ----
    const existingIssues = await prisma.issue.findMany({
      where: { reportId },
      select: { id: true, comments: { select: { id: true } } },
    });

    const incomingIds = new Set(
      incomingClean.filter((x: any) => x.id).map((x: any) => x.id)
    );

    // update/create
    for (const it of incomingClean) {
      const isExisting = it.id && existingIssues.some((e) => e.id === it.id);

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
    for (const ex of existingIssues) {
      if (!incomingIds.has(ex.id)) {
        const hasComments = (ex.comments || []).length > 0;
        if (!hasComments) {
          await prisma.issue.delete({ where: { id: ex.id } });
        } else {
          // ถ้ามีคอมเมนต์แล้ว ไม่ลบทิ้ง — เคลียร์ข้อความ/รูปแทน เพื่อเก็บประวัติ
          await prisma.issue.update({
            where: { id: ex.id },
            data: { detail: "(รายการนี้ถูกลบ/แก้ไขโดยผู้กรอก)", imageUrl: null },
          });
        }
      }
    }

    return NextResponse.json({ ok: true, reportId });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "upsert failed" },
      { status: 500 }
    );
  }
}
