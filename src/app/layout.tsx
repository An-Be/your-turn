import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { GeistMono } from "geist/font/mono";
import { connection } from "next/server";
import { Toaster } from "@/components/ui/toaster";
import { site } from "@/config/site";
import "./globals.css";

// Fonts are bundled locally so builds never depend on Google Fonts being reachable.
const spaceGrotesk = localFont({
  src: "./fonts/SpaceGrotesk-Variable.woff2",
  weight: "300 700",
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: site.name,
  description: site.description,
  robots: site.indexable ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: site.themeColor,
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The nonce-based CSP (src/proxy.ts) needs every page rendered per request;
  // a statically rendered page has no request to read the nonce from.
  await connection();
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${GeistMono.variable}`}>
      <body className="flex min-h-dvh flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
