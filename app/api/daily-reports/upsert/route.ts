// app/api/daily-reports/upsert/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function bangkokStart(dateYmd: string) {
  return new Date(`${dateYmd}T00:00:00.000+07:00`);
}

function normStr(s: any) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// เปรียบเทียบรูปแบบ dataUrl / url แบบหยาบ ๆ ให้พอจับ “เปลี่ยนรูป”
function normImg(s: any) {
  const x = String(s ?? "").trim();
  if (!x) return "";
  // ถ้าเป็น data url ให้เอา prefix พอ (กันยาวมาก)
  if (x.startsWith("data:")) return x.slice(0, 48);
  return x.toLowerCase();
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

    const saved = await prisma.dailyReport.upsert({
      where: { projectId_date: { projectId, date } },
      create: { projectId, date, payload },
      update: { payload },
      select: { id: true, projectId: true, date: true },
    });

    const reportId = saved.id;

    // ---- sync issues (ไม่ทำ comment หาย) ----
    // ✅ ต้องดึง detail/imageUrl + จำนวนคอมเมนต์ เพื่อจับเคส “แทนที่ปัญหา”
    const existing = await prisma.issue.findMany({
      where: { reportId },
      select: {
        id: true,
        detail: true,
        imageUrl: true,
        _count: { select: { comments: true } },
      },
    });

    const existingById = new Map(existing.map((e) => [e.id, e]));

    const incomingClean = incomingIssues
      .map((x: any) => ({
        id: x?.id ? String(x.id) : "",
        detail: String(x?.detail || "").trim(),
        imageUrl: String(x?.imageDataUrl || x?.imageUrl || "").trim(),
      }))
      .filter((x: any) => x.detail || x.imageUrl); // เอาเฉพาะที่มีข้อมูลจริง

    const incomingIds = new Set(
      incomingClean.filter((x: any) => x.id).map((x: any) => x.id)
    );

    // update/create
    for (const it of incomingClean) {
      const ex = it.id ? existingById.get(it.id) : null;

      if (ex) {
        const hasComments = (ex._count?.comments || 0) > 0;

        const changed =
          normStr(ex.detail) !== normStr(it.detail || "-") ||
          normImg(ex.imageUrl) !== normImg(it.imageUrl || "");

        // ✅ KEY FIX:
        // ถ้ามีคอมเมนต์แล้ว และผู้กรอก “เปลี่ยนรูป/รายละเอียด” ให้ถือว่าเป็น “ปัญหาใหม่”
        // -> สร้าง issue ใหม่, และ archive อันเก่า เพื่อเก็บประวัติคอมเมนต์ไว้
        if (hasComments && changed) {
          // 1) create new issue (new id)
          await prisma.issue.create({
            data: {
              reportId,
              detail: it.detail || "-",
              imageUrl: it.imageUrl || null,
            },
          });

          // 2) archive old issue (คอมเมนต์ไม่หาย แต่ไม่ปะปนกับปัญหาใหม่)
          await prisma.issue.update({
            where: { id: ex.id },
            data: {
              detail: "(รายการนี้ถูกลบ/แก้ไขโดยผู้กรอก)",
              imageUrl: null,
            },
          });

          // หมายเหตุ: incomingIds มี ex.id อยู่ก็ไม่เป็นไร เพราะเรา archive แล้ว
          continue;
        }

        // ✅ ปกติ: update เดิม (เคสยังไม่มีคอมเมนต์ หรือไม่ได้เปลี่ยนสาระสำคัญ)
        await prisma.issue.update({
          where: { id: ex.id },
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
        const hasComments = (ex._count?.comments || 0) > 0;
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
