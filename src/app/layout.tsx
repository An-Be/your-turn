import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

// Fonts are bundled locally so builds never depend on Google Fonts being reachable.
const spaceGrotesk = localFont({
  src: "./fonts/SpaceGrotesk-Variable.woff2",
  weight: "300 700",
  variable: "--font-space-grotesk",
  display: "swap",
});

// Nonce-based CSP (src/middleware.ts) needs every page rendered per request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TagYourTurn",
  description: "Whose turn is it today? One shared link for two people. No login, no reminders, forgets after 7 days.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
