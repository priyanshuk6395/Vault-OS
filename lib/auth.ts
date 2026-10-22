import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const LEGACY_ADMIN_ID = "priyanshuk6395";

export function eventOwnerIds(userId: string) {
  return userId === "admin-001" ? [userId, LEGACY_ADMIN_ID] : [userId];
}

export function ownsEvent(ownerId: string, userId: string | null | undefined) {
  return !!userId && eventOwnerIds(userId).includes(ownerId);
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Vault Login",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const ADMIN_USER = process.env.ADMIN_USERNAME;
        const ADMIN_PASS = process.env.ADMIN_PASSWORD;

        if (
          ADMIN_USER &&
          ADMIN_PASS &&
          credentials?.username === ADMIN_USER && 
          credentials?.password === ADMIN_PASS
        ) {
          return {
            id: "admin-001",
            name: process.env.NEXT_PUBLIC_CREATOR_NAME || "Priyanshu Kumar",
            email: "admin@vault.os",
          };
        }

        return null;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};