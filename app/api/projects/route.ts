// app/api/projects/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Project } from "@prisma/client";

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

type Row = Pick<Project, "id" | "name" | "createdAt" | "meta">;

export async function GET() {
  const rows: Row[] = await prisma.project.findMany({
    select: { id: true, name: true, createdAt: true, meta: true },
    orderBy: { createdAt: "desc" },
  });

  const projects: ProjectMeta[] = rows.map((p: Row) => {
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
