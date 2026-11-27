import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import "./globals.css";

const description = "場所をピンして、みんなで共有できるマップ";

export const metadata: Metadata = {
  title: {
    default: "PinCrew",
    template: "PinCrew | %s",
  },
  description,
  applicationName: "PinCrew",
  appleWebApp: {
    capable: true,
    title: "PinCrew",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "PinCrew",
    description,
    siteName: "PinCrew",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "PinCrew",
    description,
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F7F4EF",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" className="h-dvh antialiased">
      <body className="h-dvh overflow-hidden">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
