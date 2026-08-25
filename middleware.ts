import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const pathname = req.nextUrl.pathname;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const role = token.system_role as string;

  // STUDENT không được vào route của LECTURER/DEAN/ADMIN
  if (role === "STUDENT") {
    const blockedPrefixes = ["/supervisor", "/reviewer", "/council", "/dean", "/admin"];
    if (blockedPrefixes.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  }

  // LECTURER không được vào admin/dean
  if (role === "LECTURER") {
    if (pathname.startsWith("/admin") || pathname.startsWith("/dean")) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  }

  // DEAN không được vào admin
  if (role === "DEAN") {
    if (pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/student/:path*",
    "/supervisor/:path*",
    "/reviewer/:path*",
    "/council/:path*",
    "/dean/:path*",
    "/admin/:path*",
  ],
};
