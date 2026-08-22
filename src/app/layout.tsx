import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

import { EARLY_THEME_SCRIPT } from "@/features/theme/theme-script";
import { EARLY_PRIVACY_SCRIPT } from "@/features/privacy/privacy";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Копилка",
  description: "Спокойный персональный инструмент для денег и целей.",
  applicationName: "Копилка",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Копилка",
    statusBarStyle: "black-translucent",
    startupImage: [
      {
        url: "/pwa/splash-1290x2796.png",
        media:
          "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/pwa/splash-1179x2556.png",
        media:
          "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/pwa/splash-1170x2532.png",
        media:
          "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/pwa/splash-828x1792.png",
        media:
          "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        url: "/pwa/splash-750x1334.png",
        media:
          "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)",
      },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    shortcut: [
      { url: "/favicon-48x48.png", type: "image/png", sizes: "48x48" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4ed" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1513" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        {children}
        <Script
          id="kopilka-theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: EARLY_THEME_SCRIPT }}
        />
        <Script
          id="kopilka-privacy-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: EARLY_PRIVACY_SCRIPT }}
        />
      </body>
    </html>
  );
}
