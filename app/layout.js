import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata = {
  title: "IMS — POS & Business Management",
  description: "Premium point of sale, inventory, purchases and financials — powered by Supabase.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
