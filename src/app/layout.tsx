import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Roster Management",
  description: "Constraint-based coverage scheduling system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
