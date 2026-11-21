import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { THEME_STORAGE_KEY } from "@/lib/theme";

// Aplica o tema antes da pintura para não piscar o tema errado.
const themeScript = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

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
      suppressHydrationWarning
      className={cn("font-sans", geistSans.variable, geistMono.variable)}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-background text-foreground antialiased">
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
