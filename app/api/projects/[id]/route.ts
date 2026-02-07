// app/api/projects/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // ปรับ path ถ้าโปรเจคคุณใช้ prisma client คนละไฟล์

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;

  if (!id) {
    return NextResponse.json({ ok: false, message: "Missing project id" }, { status: 400 });
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, name: true, meta: true },
    });

    if (!project) {
      return NextResponse.json({ ok: false, message: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, project });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
