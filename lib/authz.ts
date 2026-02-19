// lib/authz.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export type Role = "USER" | "ADMIN" | "GENERATOR" | "SUPERADMIN";

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { ok: false as const, status: 401, error: "UNAUTHORIZED" };
  }
  return { ok: true as const, session };
}

export function requireRole(role: Role, userRole?: string | null) {
  if (userRole !== role) {
    return { ok: false as const, status: 403, error: "FORBIDDEN_ROLE" };
  }
  return { ok: true as const };
}
