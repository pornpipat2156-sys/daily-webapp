import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/passwordToken";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { token: string; newPassword: string };

export async function POST(req: Request) {
  const { token, newPassword } = (await req.json()) as Body;

  const raw = (token || "").trim();
  const pwd = newPassword || "";

  if (!raw || pwd.length < 8) {
    return NextResponse.json({ ok: false, message: "รหัสผ่านสั้นเกินไป" }, { status: 400 });
  }

  const tokenHash = hashToken(raw);

  const t = await prisma.passwordToken.findUnique({ where: { tokenHash } });
  if (!t || t.usedAt) {
    return NextResponse.json({ ok: false, message: "token ใช้ไม่ได้" }, { status: 400 });
  }
  if (t.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ ok: false, message: "token หมดอายุ" }, { status: 400 });
  }

  // ต้องอยู่ใน allowlist และ active
  const allow = await prisma.allowedEmail.findUnique({ where: { email: t.userEmail } });
  if (!allow || !allow.isActive) {
    return NextResponse.json({ ok: false, message: "ไม่มีสิทธิ์ใช้งาน" }, { status: 403 });
  }

  const passwordHash = await bcrypt.hash(pwd, 12);

  // upsert user แล้วใส่ role ตาม allowlist
  await prisma.user.upsert({
    where: { email: t.userEmail },
    create: {
      email: t.userEmail,
      name: allow.name ?? null,
      role: allow.role,
      isActive: true,
      passwordHash,
    },
    update: {
      name: allow.name ?? null,
      role: allow.role, // กัน role เพี้ยน
      isActive: true,
      passwordHash,
    },
  });

  await prisma.passwordToken.update({
    where: { tokenHash },
    data: { usedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
