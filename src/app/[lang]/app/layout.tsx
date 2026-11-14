import { Geist, Geist_Mono } from "next/font/google";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export default function WebAppThemeLayout({ children }: LayoutProps<"/[lang]/app">) {
  return <div className={`${geist.variable} ${geistMono.variable} theme-app min-h-dvh bg-background`}>{children}</div>;
}
