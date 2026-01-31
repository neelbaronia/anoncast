import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "anoncast - Turn Your Blog Into a Podcast",
  description: "Transform any blog post into studio-quality audio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
