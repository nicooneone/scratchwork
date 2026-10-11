import type { Metadata, Viewport } from "next";
import { Caveat, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { THEME_BOOT_SCRIPT, THEME_CHROME } from "@/lib/theme";

const ui = IBM_Plex_Sans({ variable: "--font-ui", subsets: ["latin"], weight: ["400", "500", "600"] });
const hand = Caveat({ variable: "--font-hand", subsets: ["latin"], weight: ["600", "700"] });

export const metadata: Metadata = {
  title: "RedLine",
  description: "The iPad notebook that checks your thinking, not just your answer.",
  appleWebApp: { capable: true, title: "RedLine", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

// We handle zoom ourselves on the page canvas, so the browser must not zoom the UI.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // Browser chrome follows the device setting at first; the toggle overrides it at runtime.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_CHROME.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_CHROME.dark },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is set by the boot script before React hydrates, hence suppressHydrationWarning.
    <html lang="en" className={`${ui.variable} ${hand.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
