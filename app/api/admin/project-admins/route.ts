// app/api/admin/project-admins/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getToken } from "next-auth/jwt";

async function requireSuperAdmin(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  console.log("DEBUG TOKEN:", token);
  console.log("DEBUG ROLE:", (token as any)?.role);

  const role = String((token as any)?.role || "USER");
  
  if (!token || role !== "SUPERADMIN") return null;
  return token;
}

// GET: list projects + current admins
export async function GET(req: NextRequest) {
  const ok = await requireSuperAdmin(req);
  if (!ok) return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  const links = await prisma.projectAdmin.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      projectId: true,
      userId: true,
      isActive: true,
      createdAt: true,
      project: { select: { name: true } },
      user: { select: { email: true, name: true, role: true } },
    },
  });

  return NextResponse.json({ ok: true, projects, links });
}

// POST: add/enable admin for project by email
export async function POST(req: NextRequest) {
  const ok = await requireSuperAdmin(req);
  if (!ok) return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const projectId = String(body?.projectId || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();

  if (!projectId || !email) {
    return NextResponse.json({ ok: false, message: "Missing projectId/email" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ ok: false, message: "User not found" }, { status: 404 });

  // ไม่บังคับ role=ADMIN เพราะเราใช้ ProjectAdmin เป็นตัวกำหนดสิทธิ์รายโครงการ
  // แต่ถ้าคุณอยากบังคับให้คนที่ถูกเพิ่มต้องเป็น ADMIN จริง ๆ ค่อยเพิ่มเงื่อนไขทีหลัง

  const link = await prisma.projectAdmin.upsert({
    where: { projectId_userId: { projectId, userId: user.id } },
    create: { projectId, userId: user.id, isActive: true },
    update: { isActive: true },
    select: {
      id: true,
      projectId: true,
      userId: true,
      isActive: true,
      createdAt: true,
      project: { select: { name: true } },
      user: { select: { email: true, name: true, role: true } },
    },
  });

  return NextResponse.json({ ok: true, link });
}

// DELETE: disable admin link (soft delete)
export async function DELETE(req: NextRequest) {
  const ok = await requireSuperAdmin(req);
  if (!ok) return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const id = String(body?.id || "").trim();
  if (!id) return NextResponse.json({ ok: false, message: "Missing id" }, { status: 400 });

  const updated = await prisma.projectAdmin.update({
    where: { id },
    data: { isActive: false },
    select: { id: true, isActive: true },
  });

  return NextResponse.json({ ok: true, updated });
}
