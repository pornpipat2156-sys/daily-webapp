// app/api/auth/[...nextauth]/route.ts

import NextAuth, { type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ✅ export ไว้ให้ไฟล์ API อื่น import ไปใช้ได้ (เช่น chat routes)
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const email = (creds?.email || "").toLowerCase().trim();
        const password = creds?.password || "";

        if (!email || !password) return null;

        // 1) ต้องอยู่ใน allowlist และ active
        const allow = await prisma.allowedEmail.findUnique({ where: { email } });
        if (!allow || !allow.isActive) return null;

        // 2) ต้องมี user และตั้งรหัสแล้ว
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive || !user.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // ✅ คืนข้อมูลไปทำ session/jwt (เพิ่ม position จาก allowlist)
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          name: (user as any).name ?? null,
          position: (allow as any).position ?? null,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.name = (user as any).name ?? null;
        token.position = (user as any).position ?? null;
        token.sub = (user as any).id; // ✅ ให้มี userId อยู่ใน token.sub ด้วย
      }
      return token;
    },
    async session({ session, token }) {
      (session.user as any).id = (token as any).sub; // ✅ ใส่ id ลง session.user
      (session.user as any).role = (token as any).role;
      (session.user as any).name = (token as any).name ?? null;
      (session.user as any).position = (token as any).position ?? null;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
