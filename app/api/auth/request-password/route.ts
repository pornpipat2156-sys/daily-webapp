import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateRawToken, hashToken } from "@/lib/passwordToken";
import { sendEmail } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  email: string;
  purpose?: "SET_PASSWORD" | "RESET_PASSWORD";
};

export async function POST(req: Request) {
  const okResponse = NextResponse.json({ ok: true });

  try {
    const { email, purpose = "RESET_PASSWORD" } = (await req.json()) as Body;
    const normalized = (email || "").toLowerCase().trim();

    if (!normalized) return okResponse;

    const allow = await prisma.allowedEmail.findUnique({
      where: { email: normalized },
    });

    if (!allow || !allow.isActive) {
      return okResponse;
    }

    const raw = generateRawToken();
    const tokenHash = hashToken(raw);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.passwordToken.create({
      data: {
        userEmail: normalized,
        tokenHash,
        purpose,
        expiresAt,
      },
    });

    const baseUrl =
      process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";

    if (!baseUrl) {
      console.error("request-password: missing NEXTAUTH_URL/NEXT_PUBLIC_APP_URL");
      return okResponse;
    }

    const link = `${baseUrl}/reset-password?token=${raw}`;
    const subject =
      purpose === "SET_PASSWORD"
        ? "ตั้งรหัสผ่านสำหรับเข้าใช้งาน"
        : "รีเซ็ตรหัสผ่าน";

    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.7; color: #111827;">
        <p>สวัสดี</p>
        <p>
          ${
            purpose === "SET_PASSWORD"
              ? "กรุณากดลิงก์ด้านล่างเพื่อตั้งรหัสผ่านสำหรับเข้าใช้งาน"
              : "กรุณากดลิงก์ด้านล่างเพื่อรีเซ็ตรหัสผ่าน"
          }
        </p>
        <p>
          <a
            href="${link}"
            style="display:inline-block;padding:10px 16px;border-radius:10px;background:#2563eb;color:#ffffff;text-decoration:none;"
          >
            ${
              purpose === "SET_PASSWORD"
                ? "ตั้งรหัสผ่าน"
                : "รีเซ็ตรหัสผ่าน"
            }
          </a>
        </p>
        <p>หากปุ่มไม่ทำงาน ให้นำลิงก์นี้ไปเปิดในเบราว์เซอร์:</p>
        <p style="word-break: break-all;">${link}</p>
        <p>ลิงก์จะหมดอายุภายใน 30 นาที</p>
      </div>
    `;

    const text = [
      purpose === "SET_PASSWORD"
        ? "กรุณาเปิดลิงก์นี้เพื่อตั้งรหัสผ่าน"
        : "กรุณาเปิดลิงก์นี้เพื่อรีเซ็ตรหัสผ่าน",
      link,
      "ลิงก์จะหมดอายุภายใน 30 นาที",
    ].join("\n\n");

    await sendEmail(normalized, subject, html, text);

    return okResponse;
  } catch (error) {
    console.error("POST /api/auth/request-password error:", error);
    return okResponse;
  }
}