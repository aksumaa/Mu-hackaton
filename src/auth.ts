import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/utils";
import { rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

class LoginError extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/uz/login" },
  providers: [
    Credentials({
      credentials: {
        studentId: { label: "Student ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) throw new LoginError("invalid_credentials");
        const headerStore = await headers();
        const user = await prisma.user.findFirst({ where: { studentId: { equals: parsed.data.studentId, mode: "insensitive" } } });
        const matches = user ? await argon2.verify(user.passwordHash, parsed.data.password) : false;
        if (!user || !matches || !user.isActive) {
          const limit = rateLimit(`login:${clientIp(headerStore)}`);
          if (!limit.ok) throw new LoginError("rate_limited");
          if (user && matches && !user.isActive) throw new LoginError("inactive");
          throw new LoginError("invalid_credentials");
        }
        return {
          id: user.id,
          name: user.fullName,
          email: user.email,
          role: user.role,
          studentId: user.studentId,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.studentId = user.studentId;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.role = token.role;
      session.user.studentId = token.studentId;
      session.user.mustChangePassword = token.mustChangePassword;
      return session;
    },
  },
});
