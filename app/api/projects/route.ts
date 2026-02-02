// app/api/projects/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

// ✅ กำหนดชนิดข้อมูลที่เราคาดว่าจะได้จาก DB เอง (ไม่พึ่ง @prisma/client types)
type Row = {
  id: string;
  name: string;
  createdAt: Date;
  meta: unknown | null;
};

export async function GET() {
  try {
    const rows = (await prisma.project.findMany({
      select: { id: true, name: true, createdAt: true, meta: true },
      orderBy: { createdAt: "desc" },
    })) as unknown as Row[];

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

    return NextResponse.json(projects, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    console.error("GET /api/projects failed:", err);

    return NextResponse.json(
      {
        ok: false,
        name: err?.name ?? "Error",
        message: err?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
