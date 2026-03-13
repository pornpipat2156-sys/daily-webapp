import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateRawToken, hashToken } from "@/lib/passwordToken";
import { sendEmail } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AllowedEmailInviteRow = {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  inviteAttempts: number;
};

function getBaseUrl() {
  return process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
}

function getBatchSize() {
  const raw = Number(process.env.ALLOWEDEMAIL_INVITE_BATCH_SIZE || "10");
  if (!Number.isFinite(raw) || raw <= 0) return 10;
  return Math.min(raw, 50);
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function unauthorized() {
  return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
}

function buildInviteEmail(link: string, displayName: string) {
  const subject = "ตั้งรหัสผ่านสำหรับเข้าใช้งาน";

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.7; color: #111827;">
      <p>สวัสดี ${displayName}</p>
      <p>บัญชีของคุณถูกเพิ่มเข้าสู่ระบบแล้ว กรุณากดลิงก์ด้านล่างเพื่อตั้งรหัสผ่านสำหรับเข้าใช้งานครั้งแรก</p>
      <p>
        <a
          href="${link}"
          style="display:inline-block;padding:10px 16px;border-radius:10px;background:#2563eb;color:#ffffff;text-decoration:none;"
        >
          ตั้งรหัสผ่าน
        </a>
      </p>
      <p>หากปุ่มไม่ทำงาน ให้นำลิงก์นี้ไปเปิดในเบราว์เซอร์:</p>
      <p style="word-break: break-all;">${link}</p>
      <p>ลิงก์นี้จะหมดอายุภายใน 30 นาที</p>
    </div>
  `;

  const text = [
    `สวัสดี ${displayName}`,
    "บัญชีของคุณถูกเพิ่มเข้าสู่ระบบแล้ว กรุณาเปิดลิงก์นี้เพื่อตั้งรหัสผ่านสำหรับเข้าใช้งานครั้งแรก",
    link,
    "ลิงก์นี้จะหมดอายุภายใน 30 นาที",
  ].join("\n\n");

  return { subject, html, text };
}

async function claimPendingRows(batchSize: number): Promise<AllowedEmailInviteRow[]> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<AllowedEmailInviteRow[]>(Prisma.sql`
      select
        id,
        email,
        name,
        "isActive",
        "inviteAttempts"
      from public."AllowedEmail"
      where "inviteStatus" = 'pending'
        and "isActive" = true
      order by "createdAt" asc
      limit ${batchSize}
      for update skip locked
    `);

    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);

    await tx.$executeRaw(Prisma.sql`
      update public."AllowedEmail"
      set
        "inviteStatus" = 'processing',
        "inviteAttempts" = "inviteAttempts" + 1,
        "inviteError" = null,
        "updatedAt" = now()
      where id in (${Prisma.join(ids)})
    `);

    return rows;
  });
}

async function markSent(id: string) {
  await prisma.$executeRaw(Prisma.sql`
    update public."AllowedEmail"
    set
      "inviteStatus" = 'sent',
      "inviteSentAt" = now(),
      "inviteError" = null,
      "updatedAt" = now()
    where id = ${id}
  `);
}

async function markFailed(id: string, errorMessage: string, attemptsAfterClaim: number) {
  await prisma.$executeRaw(Prisma.sql`
    update public."AllowedEmail"
    set
      "inviteStatus" = case
        when ${attemptsAfterClaim} >= 5 then 'failed'
        else 'pending'
      end,
      "inviteError" = ${errorMessage},
      "updatedAt" = now()
    where id = ${id}
  `);
}

async function processOne(row: AllowedEmailInviteRow) {
  const normalizedEmail = (row.email || "").toLowerCase().trim();
  if (!normalizedEmail) {
    throw new Error("missing email");
  }

  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    throw new Error("Missing NEXTAUTH_URL or NEXT_PUBLIC_APP_URL");
  }

  const raw = generateRawToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await prisma.passwordToken.create({
    data: {
      userEmail: normalizedEmail,
      tokenHash,
      purpose: "SET_PASSWORD",
      expiresAt,
    },
  });

  const resetLink = `${baseUrl}/reset-password?token=${raw}`;
  const displayName = row.name?.trim() || normalizedEmail;
  const { subject, html, text } = buildInviteEmail(resetLink, displayName);

  await sendEmail(normalizedEmail, subject, html, text);
  await markSent(row.id);
}

async function runWorker() {
  const rows = await claimPendingRows(getBatchSize());

  if (rows.length === 0) {
    return { ok: true, claimed: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      await processOne(row);
      sent += 1;
    } catch (error: any) {
      failed += 1;
      await markFailed(
        row.id,
        String(error?.message || error),
        (row.inviteAttempts || 0) + 1
      );
      console.error("process-allowed-email-invites error:", {
        id: row.id,
        email: row.email,
        error,
      });
    }
  }

  return {
    ok: true,
    claimed: rows.length,
    sent,
    failed,
  };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  return NextResponse.json(await runWorker());
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  return NextResponse.json(await runWorker());
}