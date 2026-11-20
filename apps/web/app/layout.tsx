import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Notion Automation",
  description:
    "API que gera no Notion a rotina de planejamento Ano, Trimestres, Meses, Semanas e Dias.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={cn("font-sans", geistSans.variable, geistMono.variable)}
    >
      <body className="bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
