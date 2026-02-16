// app/api/allow-email/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  id: string; // userId
  email: string;
  name: string | null;
  role: string;
};

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const meId = (session as any)?.user?.id as string | undefined;
    const myRole = (session as any)?.user?.role as string | undefined;

    if (!session || !meId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") || "";

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // ✅ สิทธิ์เข้าถึง:
    // - SUPERADMIN เข้าได้ทุกโปรเจกต์
    // - หรือเป็น ProjectAdmin ของโปรเจกต์นั้น (isActive=true)
    if (myRole !== "SUPERADMIN") {
      const pa = await prisma.projectAdmin.findFirst({
        where: { projectId, userId: meId, isActive: true },
        select: { id: true },
      });
      if (!pa) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    // ✅ เอารายชื่อจาก AllowEmail (active) แล้ว map ไป User (ต้องมี user จริงเพื่อให้ได้ userId)
    // ถ้า AllowEmail มีแต่ยังไม่มี User -> จะไม่ส่งกลับ (เพราะ add เข้ากลุ่มต้องใช้ userId)
    const allow = await prisma.allowedEmail.findMany({
      where: { isActive: true },
      select: { email: true, name: true },
      orderBy: { email: "asc" },
    });

    const emails = allow.map((a) => a.email.toLowerCase().trim()).filter(Boolean);

    const users = await prisma.user.findMany({
      where: { email: { in: emails }, isActive: true },
      select: { id: true, email: true, name: true, role: true },
      orderBy: { email: "asc" },
    });

    const allowNameByEmail = new Map<string, string | null>();
    for (const a of allow) allowNameByEmail.set(a.email.toLowerCase().trim(), a.name ?? null);

    const rows: Row[] = users.map((u) => ({
      id: u.id,
      email: u.email,
      // ใช้ชื่อจาก User ก่อน ถ้าไม่มีค่อย fallback ชื่อใน AllowEmail
      name: u.name ?? allowNameByEmail.get(u.email.toLowerCase().trim()) ?? null,
      role: String(u.role),
    }));

    return NextResponse.json(rows);
  } catch (e: any) {
    console.error("GET /api/allow-email error:", e);
    return NextResponse.json({ error: "SERVER_ERROR", detail: String(e?.message || e) }, { status: 500 });
  }
}
