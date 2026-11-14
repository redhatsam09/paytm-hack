import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Vani Soundbox — Autonomous Voice-to-QR, Credit Recovery & Restock Agent",
  description: "Paytm Build for India AI Hackathon | Track 1: Merchant Growth AI | Dual-Screen Soundbox & WhatsApp Agent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="bg-white text-[#0A1B3D] min-h-screen">
        {children}
      </body>
    </html>
  );
}
