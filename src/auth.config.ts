import type { NextAuthConfig } from "next-auth";

// Configuración base, segura para el runtime edge (sin base de datos ni bcrypt).
// La usa el middleware para proteger rutas. Los providers se añaden en auth.ts.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    // Protege todo excepto la página de login. Redirige según estado de sesión.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");

      if (isOnLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      // Cualquier otra ruta requiere sesión.
      return isLoggedIn;
    },
    // Propaga id y rol al token.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.name = user.name;
      }
      return token;
    },
    // Expone id y rol en la sesión.
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "admin" | "cfo" | "vendedor";
      }
      return session;
    },
  },
  providers: [], // se rellena en auth.ts
} satisfies NextAuthConfig;
