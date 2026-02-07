// app/api/projects/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, ctx: { params: { id: string } }) {
  const id = (ctx.params?.id || "").trim();
  if (!id) return NextResponse.json({ ok: false, message: "missing id" }, { status: 400 });

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, meta: true },
  });

  if (!project) return NextResponse.json({ ok: false, message: "not found" }, { status: 404 });

  return NextResponse.json({ ok: true, project });
}
