import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

// Protect all routes starting with /admin
export const config = { 
  matcher: ["/admin/:path*"] 
};