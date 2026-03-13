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

  /** ✅ เพิ่ม: พิกัดสถานที่ก่อสร้างจาก meta jsonb */
  siteLatitude?: number | null;
  siteLongitude?: number | null;

  // ✅ options สำหรับ dropdown (อยู่ใน meta jsonb)
  contractorNameOptions?: string[];
  contractorPositionOptions?: string[];
  subContractorPositionOptions?: string[];
  equipmentTypeOptions?: string[];
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

  siteLatitude: null,
  siteLongitude: null,

  contractorNameOptions: [],
  contractorPositionOptions: [],
  subContractorPositionOptions: [],
  equipmentTypeOptions: [],
};

// ✅ กำหนดชนิดข้อมูลจาก DB
type Row = {
  id: string;
  name: string;
  createdAt: Date;
  meta: unknown | null;
};

function asStringArray(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x.filter((v) => typeof v === "string") as string[];
}

function asNullableNumber(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string" && x.trim() !== "") {
    const parsed = Number(x);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export async function GET() {
  try {
    const rows = (await prisma.project.findMany({
      select: { id: true, name: true, createdAt: true, meta: true },
      orderBy: { createdAt: "desc" },
    })) as unknown as Row[];

    const projects: ProjectMeta[] = rows.map((p: Row) => {
      const m = (p.meta ?? {}) as ProjectMetaDb & Record<string, unknown>;

      return {
        id: p.id,
        projectName: p.name,
        ...emptyMeta,
        ...m,

        // ✅ กันพัง + บังคับเป็น string[]
        supervisors: asStringArray(m.supervisors),

        // ✅ อ่านพิกัดจาก Project.meta
        siteLatitude: asNullableNumber(m.siteLatitude),
        siteLongitude: asNullableNumber(m.siteLongitude),

        contractorNameOptions: asStringArray(m.contractorNameOptions),
        contractorPositionOptions: asStringArray(m.contractorPositionOptions),
        subContractorPositionOptions: asStringArray(m.subContractorPositionOptions),
        equipmentTypeOptions: asStringArray(m.equipmentTypeOptions),
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