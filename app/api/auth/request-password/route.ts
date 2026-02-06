import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateRawToken, hashToken } from "@/lib/passwordToken";
import { sendEmail } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { email: string; purpose?: "SET_PASSWORD" | "RESET_PASSWORD" };

export async function POST(req: Request) {
  const { email, purpose = "RESET_PASSWORD" } = (await req.json()) as Body;
  const normalized = (email || "").toLowerCase().trim();

  // ตอบเหมือนเดิมเสมอ กัน enum user
  const okResponse = NextResponse.json({ ok: true });

  if (!normalized) return okResponse;

  // ต้องอยู่ใน allowlist และ active เท่านั้น
  const allow = await prisma.allowedEmail.findUnique({ where: { email: normalized } });
  if (!allow || !allow.isActive) return okResponse;

  // สร้าง token
  const raw = generateRawToken();
  const tokenHash = hashToken(raw);

  // หมดอายุ 30 นาที
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await prisma.passwordToken.create({
    data: {
      userEmail: normalized,
      tokenHash,
      purpose,
      expiresAt,
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  const path = purpose === "SET_PASSWORD" ? "/set-password" : "/reset-password";
  const link = `${baseUrl}${path}?token=${raw}`;

  await sendEmail(
    normalized,
    purpose === "SET_PASSWORD" ? "ตั้งรหัสผ่านสำหรับเข้าใช้งาน" : "รีเซ็ตรหัสผ่าน",
    `<p>กดลิงก์เพื่อดำเนินการ:</p><p><a href="${link}">${link}</a></p><p>ลิงก์หมดอายุใน 30 นาที</p>`
  );

  return okResponse;
}
