import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession();
  const role = (session?.user as any)?.role;

  if (role !== "ADMIN") {
    return NextResponse.json({ ok: false, message: "forbidden" }, { status: 403 });
  }

  const { email,name, role: newRole = "USER" } = await req.json();
  const normalized = (email || "").toLowerCase().trim();
  const displayName = typeof name === "string" ? name.trim() : null;
  if (!normalized) return NextResponse.json({ ok: false }, { status: 400 });

  const row = await prisma.allowedEmail.upsert({
  where: { email: normalized },
  create: { email: normalized, name: displayName || null, role: newRole, isActive: true },
  update: { name: displayName || null, role: newRole, isActive: true },
});

  return NextResponse.json({ ok: true, row });
}
