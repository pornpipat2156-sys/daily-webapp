import { NextResponse, type NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser, requireRole } from "@/lib/auth";
import { generateRawToken, hashToken } from "@/lib/passwordToken";
import { sendEmail } from "@/lib/mailer";

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

    if (!sendInvite) {
      return NextResponse.json({ ok: true, row, emailSent: false });
    }

    const baseUrl =
      process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;

    if (!baseUrl) {
      return NextResponse.json({
        ok: true,
        row,
        emailSent: false,
        message: "saved_allowlist_but_missing_app_url",
      });
    }

    const raw = generateRawToken();
    const tokenHash = hashToken(raw);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.passwordToken.create({
      data: {
        userEmail: normalized,
        tokenHash,
        purpose: "SET_PASSWORD",
        expiresAt,
      },
    });

    const resetLink = `${baseUrl}/reset-password?token=${raw}`;
    const displayNameOrEmail = displayName || normalized;

    try {
      await sendEmail(
        normalized,
        "ตั้งรหัสผ่านสำหรับเข้าใช้งาน",
        `
          <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.7; color: #111827;">
            <p>สวัสดี ${displayNameOrEmail}</p>
            <p>บัญชีของคุณถูกเพิ่มเข้าสู่ระบบแล้ว กรุณากดลิงก์ด้านล่างเพื่อตั้งรหัสผ่านสำหรับเข้าใช้งานครั้งแรก</p>
            <p>
              <a
                href="${resetLink}"
                style="display:inline-block;padding:10px 16px;border-radius:10px;background:#2563eb;color:#ffffff;text-decoration:none;"
              >
                ตั้งรหัสผ่าน
              </a>
            </p>
            <p>หรือนำลิงก์นี้ไปเปิดในเบราว์เซอร์:</p>
            <p style="word-break: break-all;">${resetLink}</p>
            <p>ลิงก์นี้จะหมดอายุภายใน 30 นาที</p>
          </div>
        `
      );

      return NextResponse.json({
        ok: true,
        row,
        emailSent: true,
      });
    } catch (mailError: any) {
      console.error("POST /api/admin/allowlist send mail error:", mailError);

      return NextResponse.json({
        ok: true,
        row,
        emailSent: false,
        message: "allowlist_saved_but_email_failed",
        detail: String(mailError?.message || mailError),
      });
    }
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