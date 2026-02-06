// app/api/auth/reset-password/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/passwordToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  token: string;
  password: string;
  // optional: ใช้ร่วมกันได้ทั้ง "SET_PASSWORD" / "RESET_PASSWORD"
  purpose?: "SET_PASSWORD" | "RESET_PASSWORD";
};

export async function POST(req: Request) {
  try {
    const { token, password, purpose = "RESET_PASSWORD" } = (await req.json()) as Body;

    if (!token || !password) {
      return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
    }

    // 1) hash token ให้ตรงกับที่เก็บใน DB
    const tokenHash = hashToken(token);

    // 2) หา token record
    const record = await prisma.passwordToken.findFirst({
      where: {
        tokenHash,
        purpose,
        // ถ้ามี usedAt ให้กันใช้ซ้ำ
        OR: [{ usedAt: null }, { usedAt: { equals: undefined as any } }],
      } as any,
    });

    if (!record) {
      return NextResponse.json({ ok: false, error: "TOKEN_NOT_FOUND" }, { status: 400 });
    }

    // 3) เช็คหมดอายุ
    if (record.expiresAt && record.expiresAt < new Date()) {
      return NextResponse.json({ ok: false, error: "TOKEN_EXPIRED" }, { status: 400 });
    }

    // 4) hash password
    const hashed = await bcrypt.hash(password, 10);

    // 5) อัปเดตรหัสผ่านผู้ใช้
    // *** ปรับ field ให้ตรงกับ schema ของคุณ ***
    // ถ้าใน User เป็น passwordHash -> เปลี่ยนเป็น { passwordHash: hashed }
    await prisma.user.update({
      where: { email: record.userEmail },
      data: { passwordHash: hashed } as any,
    });

    // 6) ปิด token (เลือกอย่างใดอย่างหนึ่ง)
    // A) mark usedAt (แนะนำถ้ามีคอลัมน์ usedAt)
    try {
      await prisma.passwordToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() } as any,
      });
    } catch {
      // B) ถ้าไม่มี usedAt ก็ลบทิ้ง
      await prisma.passwordToken.delete({ where: { id: record.id } });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("RESET_PASSWORD_ERROR:", err);
    return new NextResponse(null, { status: 500 });
  }
}
