// lib/permissions.ts
import { prisma } from "@/lib/prisma";

// ✅ ทำเพื่อ: ตรวจว่า user เป็น "สมาชิกกลุ่มจริง" ของ project และยัง active อยู่
export async function requireProjectMember(projectId: string, userId: string) {
  const member = await prisma.chatGroupMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true, isActive: true },
  });

  if (!member) return { ok: false as const, status: 403, error: "NOT_A_MEMBER" };
  if (!member.isActive) return { ok: false as const, status: 403, error: "MEMBER_DISABLED" };

  return { ok: true as const, member };
}

// ✅ ทำเพื่อ: อนุญาตให้ SuperAdmin ทำงานจัดการสมาชิก/ระบบได้
export async function requireSuperAdmin(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (u?.role !== "SUPERADMIN") return { ok: false as const, status: 403, error: "FORBIDDEN_SUPERADMIN" };
  return { ok: true as const };
}
