import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "anoncast - Turn Your Blog Into a Podcast",
  description: "Transform any blog post or essay into studio-quality audio you can share with the world.",
  openGraph: {
    title: "anoncast - Turn Your Blog Into a Podcast",
    description: "Transform any blog post or essay into studio-quality audio you can share with the world.",
    url: "https://www.anoncast.net",
    siteName: "anoncast",
    images: [
      {
        url: "https://pub-9c1086c73aa54425928d7ac6861030dd.r2.dev/Anoncast.jpg",
        width: 1200,
        height: 1200,
        alt: "anoncast podcast icon",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "anoncast - Turn Your Blog Into a Podcast",
    description: "Transform any blog post or essay into studio-quality audio you can share with the world.",
    images: ["https://pub-9c1086c73aa54425928d7ac6861030dd.r2.dev/Anoncast.jpg"],
  },
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
