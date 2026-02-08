import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, requireRole } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);

  if (!user || !requireRole(user.role, ["ADMIN", "SUPERADMIN"])) {
    return NextResponse.json(
      { ok: false, message: "forbidden" },
      { status: 403 }
    );
  }

  const { email, name, role: newRole = "USER" } = await req.json();
  const normalized = (email || "").toLowerCase().trim();
  const displayName = typeof name === "string" ? name.trim() : null;

  if (!normalized) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const row = await prisma.allowedEmail.upsert({
    where: { email: normalized },
    create: {
      email: normalized,
      name: displayName,
      role: newRole,
      isActive: true,
    },
    update: {
      name: displayName,
      role: newRole,
      isActive: true,
    },
  });

  return NextResponse.json({ ok: true, row });
}
