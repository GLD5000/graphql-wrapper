import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GraphQL Wrapper API",
  description: "GraphQL wrapper for CrUX History and PageSpeed Insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
