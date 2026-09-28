import type { Metadata, Viewport } from "next";
import "@fontsource-variable/onest";
import "@fontsource/unbounded/cyrillic-600.css";
import "@fontsource/unbounded/latin-600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Тендерная площадка",
  description: "Тендеры на строительные работы",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
