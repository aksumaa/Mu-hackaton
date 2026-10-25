import type { DefaultSession } from "next-auth";

type AppRole = "PARTICIPANT" | "JUDGE" | "ADMIN";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      studentId: string;
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: AppRole;
    studentId: string;
    mustChangePassword: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role: AppRole;
    studentId: string;
    mustChangePassword: boolean;
  }
}
