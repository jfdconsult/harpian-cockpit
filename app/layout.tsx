import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HARPIAN · Cockpit Gestor",
  description: "Cockpit interno da gestão — Harpian Capital",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
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
