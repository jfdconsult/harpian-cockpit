import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HARPIAN · Manager Cockpit",
  description: "Internal management cockpit — Harpian Capital",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-US">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3/dist/tabler-icons.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
