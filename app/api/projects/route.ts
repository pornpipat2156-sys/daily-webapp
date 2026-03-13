// app/api/projects/route.ts

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
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

function mapProjectRow(p: Row): ProjectMeta {
  const m = (p.meta ?? {}) as ProjectMetaDb & Record<string, unknown>;

  return {
    id: p.id,
    projectName: p.name,
    ...emptyMeta,
    ...m,
    supervisors: asStringArray(m.supervisors),
    siteLatitude: asNullableNumber(m.siteLatitude),
    siteLongitude: asNullableNumber(m.siteLongitude),
    contractorNameOptions: asStringArray(m.contractorNameOptions),
    contractorPositionOptions: asStringArray(m.contractorPositionOptions),
    subContractorPositionOptions: asStringArray(m.subContractorPositionOptions),
    equipmentTypeOptions: asStringArray(m.equipmentTypeOptions),
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "").trim().toLowerCase();

    // ใช้เฉพาะหน้า chat/contact:
    // - SUPERADMIN เห็นทุกโครงการ
    // - ADMIN/USER เห็นเฉพาะโครงการที่เป็นสมาชิกและ active
    if (scope === "chat") {
      const session = await getServerSession(authOptions);
      if (!session) {
        return new NextResponse("Unauthorized", { status: 401 });
      }

      const meId = (session as any)?.user?.id as string | undefined;
      const role = (session as any)?.user?.role as string | undefined;

      if (role !== "SUPERADMIN") {
        if (!meId) {
          return new NextResponse("Missing session user id", { status: 400 });
        }

        const memberships = await prisma.chatGroupMember.findMany({
          where: {
            userId: meId,
            isActive: true,
          },
          select: {
            projectId: true,
          },
        });

        const projectIds = Array.from(
          new Set(
            memberships
              .map((m) => String(m.projectId || "").trim())
              .filter(Boolean)
          )
        );

        if (projectIds.length === 0) {
          return NextResponse.json([], {
            headers: { "Cache-Control": "no-store" },
          });
        }

        const rows = (await prisma.project.findMany({
          where: {
            id: { in: projectIds },
          },
          select: { id: true, name: true, createdAt: true, meta: true },
          orderBy: { createdAt: "desc" },
        })) as unknown as Row[];

        const projects: ProjectMeta[] = rows.map(mapProjectRow);

        return NextResponse.json(projects, {
          headers: { "Cache-Control": "no-store" },
        });
      }
    }

    const rows = (await prisma.project.findMany({
      select: { id: true, name: true, createdAt: true, meta: true },
      orderBy: { createdAt: "desc" },
    })) as unknown as Row[];

    const projects: ProjectMeta[] = rows.map(mapProjectRow);

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