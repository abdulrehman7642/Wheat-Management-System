import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "./components/RegisterSW";

export const metadata: Metadata = {
  title: "Malik Yaseen & Company",
  description: "Wheat business management system",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192", apple: "/icon-192" },
  appleWebApp: {
    capable: true,
    title: "Malik Yaseen",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A1628",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}