// app/api/projects/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export type ProjectMeta = {
  id: string;
  projectName: string;

  contractNo: string;
  annexNo: string;
  contractStart: string;
  contractEnd: string;
  contractorName: string;
  siteLocation: string;
  contractValue: string;
  procurementMethod: string;
  installmentCount: number;
  totalDurationDays: number;

  dailyReportNo: string;
  periodNo: string;
  weekNo: string;

  supervisors: string[];
};

type ProjectMetaDb = Partial<Omit<ProjectMeta, "id" | "projectName">>;

const emptyMeta: Omit<ProjectMeta, "id" | "projectName"> = {
  contractNo: "",
  annexNo: "",
  contractStart: "",
  contractEnd: "",
  contractorName: "",
  siteLocation: "",
  contractValue: "",
  procurementMethod: "",
  installmentCount: 0,
  totalDurationDays: 0,
  dailyReportNo: "",
  periodNo: "",
  weekNo: "",
  supervisors: [],
};

export async function GET() {
  const rows = await prisma.project.findMany({
    select: { id: true, name: true, createdAt: true, meta: true },
    orderBy: { createdAt: "desc" },
  });

  const projects: ProjectMeta[] = rows.map((p) => {
    // ✅ ไม่ใช้ Prisma namespace แล้ว เพื่อให้ build บน Vercel ผ่านชัวร์
    const m = (p.meta ?? {}) as unknown as ProjectMetaDb;

    return {
      id: p.id,
      projectName: p.name,
      ...emptyMeta,
      ...m,
      supervisors: Array.isArray(m.supervisors) ? (m.supervisors as string[]) : [],
    };
  });

  return NextResponse.json(projects);
}
