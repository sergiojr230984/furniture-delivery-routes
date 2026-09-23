import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getLocale } from "@/lib/i18n";
import PWARegister from "@/components/PWARegister";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "Belliza Delivery",
  description: "Book, track and dispatch furniture deliveries in Miami.",
  manifest: "/manifest.webmanifest",
  icons: [{ rel: "icon", url: "/icon.svg" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#152a5a",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
