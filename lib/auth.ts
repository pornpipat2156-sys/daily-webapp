// lib/auth.ts
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export type AppRole = "USER" | "ADMIN" | "SUPERADMIN" | "GENERATOR";

export async function getAuthUser(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!token?.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: token.email },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) return null;
  return user; // role มาจาก DB สด ๆ
}

export function requireRole(userRole: AppRole, allowed: AppRole[]) {
  return allowed.includes(userRole);
}
