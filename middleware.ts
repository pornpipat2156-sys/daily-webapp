// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

type Role = "USER" | "ADMIN" | "GENERATOR";

function isAllowed(pathname: string, role: Role) {
  if (role === "USER") return pathname.startsWith("/daily-report") || pathname.startsWith("/contact");
  if (role === "ADMIN") {
    if (pathname.startsWith("/generator")) return false;
    return true;
  }
  if (role === "GENERATOR") return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // เปิด /login ได้เสมอ
  if (pathname.startsWith("/login")) return NextResponse.next();

  // อ่าน token จาก cookie (JWT strategy)
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET, // สำคัญมาก
  });

  // ยังไม่ login -> ไป /login
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const role = ((token as any).role || "USER") as Role;

  // role ไม่ผ่าน -> ส่งกลับ daily-report
  if (!isAllowed(pathname, role)) {
    const url = req.nextUrl.clone();
    url.pathname = "/daily-report";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/daily-report/:path*",
    "/commentator/:path*",
    "/sumation/:path*",
    "/contact/:path*",
    "/generator/:path*",
  ],
};
