import { Inter } from "next/font/google";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata = {
  title: "IMS — POS & Business Management",
  description: "Point of sale, inventory, purchases and financials workspace.",
  appleWebApp: {
    capable: true,
    title: "IMS",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon-192.png",
  },
};

export const viewport = {
  themeColor: "#2563EB",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full font-sans">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
