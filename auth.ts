// auth.ts
import "server-only";
import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },

  // ✅ บังคับให้ NextAuth ใช้หน้า login ของคุณเสมอ (แก้ login ซ้อน)
  pages: { signIn: "/login" },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        console.log("✅ authorize called, credentials =", credentials);

        // 1) กันค่าว่าง
        if (!credentials?.email || !credentials?.password) {
          console.log("❌ missing email/password");
          return null;
        }

        // 2) แปลง input ให้เป็นมาตรฐาน
        const email = credentials.email.toString().trim().toLowerCase();
        const password = credentials.password.toString().trim();

        console.log("✅ parsed =", { email, passwordLen: password.length });

        // 3) อ่านบัญชี demo จาก .env.local
        const users = [
          {
            id: "u1",
            email: (process.env.DEMO_USER_EMAIL ?? "").trim().toLowerCase(),
            password: (process.env.DEMO_USER_PASSWORD ?? "").trim(),
            name: "User",
            role: "USER",
          },
          {
            id: "a1",
            email: (process.env.DEMO_ADMIN_EMAIL ?? "").trim().toLowerCase(),
            password: (process.env.DEMO_ADMIN_PASSWORD ?? "").trim(),
            name: "Admin",
            role: "ADMIN",
          },
          {
            id: "g1",
            email: (process.env.DEMO_GEN_EMAIL ?? "").trim().toLowerCase(),
            password: (process.env.DEMO_GEN_PASSWORD ?? "").trim(),
            name: "Generator",
            role: "GENERATOR",
          },
        ];

        // (ช่วย debug ว่า env ถูกอ่านจริงไหม)
        console.log("✅ env loaded =", users.map((u) => ({ id: u.id, email: u.email })));

        // 4) หา user ที่ email+password ตรงกัน
        const found = users.find((u) => u.email === email && u.password === password);

        if (!found) {
          console.log("❌ invalid credentials: not found");
          return null;
        }

        console.log("✅ login success as =", { id: found.id, role: found.role });

        // 5) ✅ สำคัญ: ต้อง return object ให้ NextAuth
        return {
          id: found.id,
          name: found.name,
          email: found.email,
          role: found.role,
        } as any;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      // @ts-expect-error
      session.user.role = token.role;
      return session;
    },
  },
};
