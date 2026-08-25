import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/lib/sheets/client";
import type { SystemRole } from "@/types";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    async signIn({ user }) {
      if (!user.email) return "/login?error=OAuthSignin";

      try {
        const dbUser = await db.users.findByEmail(user.email);
        if (!dbUser) return "/login?error=NotRegistered";

        const isActive =
          dbUser.is_active === undefined ||
          dbUser.is_active === "" ||
          dbUser.is_active?.toString().toUpperCase() === "TRUE";

        if (!isActive) return "/login?error=Disabled";

        // ✅ Tự động cập nhật full_name từ Google nếu Sheet để trống
        // hoặc nếu muốn luôn đồng bộ tên Google → đổi điều kiện thành: dbUser.full_name !== user.name
        if (!dbUser.full_name && user.name && dbUser.id) {
          await db.users.update(dbUser.id, {
            full_name: user.name,
          });
        }

        return true;
      } catch (err) {
        console.error("[AUTH] signIn error:", err);
        return "/login?error=SheetError";
      }
    },

    async jwt({ token, user, account }) {
      if (account && user?.email) {
        // Save OAuth tokens on first sign in
        if (account.access_token) token.access_token = account.access_token;
        if (account.refresh_token) token.refresh_token = account.refresh_token;
        if (account.expires_at) token.token_expires_at = account.expires_at;



        try {
          const dbUser = await db.users.findByEmail(user.email);
          if (dbUser) {
            token.id = dbUser.id || user.email;
            token.system_role = (dbUser.system_role as SystemRole) || "STUDENT";
            token.student_code = dbUser.student_code || undefined;
            token.department = dbUser.department || undefined;
            token.major = (dbUser as Record<string, string>).major || undefined;
            token.is_tbm = (dbUser as Record<string, string>).is_tbm === "true" ? "true" : "false";
            // ✅ Ưu tiên tên từ Google (user.name) nếu Sheet để trống
            token.full_name = dbUser.full_name || user.name || "";
          }
        } catch (err) {
          console.error("[AUTH] jwt error:", err);
        }
      }

      // Refresh access token if it expires within 5 minutes
      const expiresAt = token.token_expires_at as number | undefined;
      if (expiresAt && Date.now() / 1000 > expiresAt - 300 && token.refresh_token) {
        try {
          const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              grant_type: "refresh_token",
              refresh_token: token.refresh_token as string,
            }),
          });
          const refreshed = await res.json();
          if (refreshed.access_token) {
            token.access_token = refreshed.access_token;
            token.token_expires_at = Math.floor(Date.now() / 1000) + refreshed.expires_in;
          }
        } catch (err) {
          console.error("[AUTH] token refresh error:", err);
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || session.user.email!;
        session.user.system_role =
          (token.system_role as SystemRole) || "STUDENT";
        session.user.student_code = token.student_code as string | undefined;
        session.user.department = token.department as string | undefined;
        session.user.major = token.major as string | undefined;
        session.user.is_tbm = token.is_tbm as string | undefined;
        session.user.name = (token.full_name as string) || session.user.name;
        session.access_token = token.access_token as string | undefined;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },

  secret: process.env.NEXTAUTH_SECRET,
};

// ─── Extend NextAuth types ────────────────────────────────────
declare module "next-auth" {
  interface Session {
    access_token?: string;
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
      system_role: SystemRole;
      student_code?: string;
      department?: string;
      major?: string;
      is_tbm?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    system_role: SystemRole;
    student_code?: string;
    department?: string;
    major?: string;
    is_tbm?: string;
    full_name?: string;
    access_token?: string;
    refresh_token?: string;
    token_expires_at?: number;
  }
}
