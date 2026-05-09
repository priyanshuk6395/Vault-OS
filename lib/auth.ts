import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Vault Login",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // 1. Check against hardcoded ENV variables
        const ADMIN_USER = process.env.ADMIN_USERNAME;
        const ADMIN_PASS = process.env.ADMIN_PASSWORD;

        if (
          credentials?.username === ADMIN_USER && 
          credentials?.password === ADMIN_PASS
        ) {
          // Return a static "God-Mode" user object
          return {
            id: "admin-001",
            name: "System Administrator",
            email: "admin@vault.os",
          };
        }

        // Authentication failed
        return null;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Pass the ID to the token on initial login
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Pass the ID from the token to the session
      if (session.user) {
        (session.user as any).id = token.id;
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