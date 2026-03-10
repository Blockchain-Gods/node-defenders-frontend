import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Node Defenders",
  description: "A cyberpunk tower defense game. Built on-chain.",
  openGraph: {
    title: "Node Defenders",
    description: "A cyberpunk tower defense game. Built on-chain.",
    url: "https://defenders.blockchaingods.io",
    siteName: "Blockchain Gods",
    images: [
      {
        url: "https://cdn.blockchaingods.io/og-image.png",
        width: 1200,
        height: 630,
        alt: "Node Defenders",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Node Defenders",
    description: "A cyberpunk tower defense game. Built on-chain.",
    images: ["https://cdn.blockchaingods.io/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
