import type { Metadata } from "next";
import { Archivo_Black, Asap } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { ScrollFX } from "@/components/ScrollFX";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const display = Archivo_Black({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--font-archivo",
});

const sans = Asap({
  subsets: ["latin", "latin-ext"],
  variable: "--font-asap",
});

export const metadata: Metadata = {
  title: "Asbob-uskunalar ijarasi",
  description: "Bir martalik ish uchun kerakli asbobni toping va ijara narxini hisoblang.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={`${display.variable} ${sans.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased" data-entrance="line-blocks">
        <AuthProvider>
          <ScrollFX />
          <SiteHeader />
          <main id="main" className="page-top flex-1">
            {children}
          </main>
          <SiteFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
