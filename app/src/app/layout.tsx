import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Google Photos Integration",
  description: "Securely select and display photos from your Google Photos library",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
