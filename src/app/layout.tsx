import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Price-Vault",
  description: "Price-Vault",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased min-h-screen overflow-x-hidden bg-white text-neutral-900`}>
        {children}
      </body>
    </html>
  );
}
