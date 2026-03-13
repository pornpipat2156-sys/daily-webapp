import { NextResponse, type NextRequest } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser, requireRole } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  email?: string;
  name?: string | null;
  role?: Role;
  sendInvite?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);

    if (!user || !requireRole(user.role, ["ADMIN", "SUPERADMIN"])) {
      return NextResponse.json(
        { ok: false, message: "forbidden" },
        { status: 403 }
      );
    }

    const {
      email,
      name,
      role: newRole = Role.USER,
      sendInvite = true,
    } = (await req.json()) as Body;

    const normalized = (email || "").toLowerCase().trim();
    const displayName = typeof name === "string" ? name.trim() : null;

    if (!normalized) {
      return NextResponse.json(
        { ok: false, message: "email is required" },
        { status: 400 }
      );
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

    if (sendInvite) {
      await prisma.$executeRaw(
        Prisma.sql`
          update public."AllowedEmail"
          set
            "inviteStatus" = 'pending',
            "inviteSentAt" = null,
            "inviteError" = null,
            "inviteAttempts" = 0,
            "updatedAt" = now()
          where email = ${normalized}
            and "isActive" = true
        `
      );
    }

    return NextResponse.json({
      ok: true,
      row,
      emailQueued: sendInvite,
    });
  } catch (e: any) {
    console.error("POST /api/admin/allowlist error:", e);

    return NextResponse.json(
      {
        ok: false,
        message: "server_error",
        detail: String(e?.message || e),
      },
      { status: 500 }
    );
  }
}