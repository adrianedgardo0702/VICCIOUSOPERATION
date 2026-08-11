import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export const { auth: proxy } = NextAuth(authConfig);

export default proxy;

export const config = {
  // Protege todas las rutas excepto assets estáticos y la API de auth.
  matcher: ["/((?!api/auth|api/health|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
