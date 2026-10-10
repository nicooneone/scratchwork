import type { Metadata, Viewport } from "next";

import "./globals.css";

const ui = { variable: "" };
const hand = { variable: "" };

export const metadata: Metadata = {
  title: "Scratchwork",
  description: "The iPad notebook that checks your thinking, not just your answer.",
  appleWebApp: { capable: true, title: "Scratchwork", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

// We handle zoom ourselves on the page canvas, so the browser must not zoom the UI.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1d2a44",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${ui.variable} ${hand.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
