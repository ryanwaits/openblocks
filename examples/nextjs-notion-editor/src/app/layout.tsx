import type { Metadata } from "next";
import "highlight.js/styles/github.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Notion-style Editor — Lively Example",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-[#37352f] antialiased">{children}</body>
    </html>
  );
}
