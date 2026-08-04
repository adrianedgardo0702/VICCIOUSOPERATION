import type { Metadata } from "next";
import { Inter, Sora, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Cuerpo / UI: Inter (excelentes numerales tabulares para tablas de datos).
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Títulos y cifras grandes: Sora (geométrica, aire "lab/tech").
const sora = Sora({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vicious Lab — Operaciones",
  description: "Sistema de operaciones multi-negocio: finanzas, inventario, pedidos y envíos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${sora.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
