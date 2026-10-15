import type { Metadata, Viewport } from "next";
import { Baloo_2, Kalam } from "next/font/google";
import "./globals.css";

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const kalam = Kalam({
  variable: "--font-kalam",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

export const metadata: Metadata = {
  title: "Ustaad — your science class with Meera Ma'am",
  description: "A voice-first science teacher for classes 6 and 10 who teaches like a real Indian classroom teacher.",
};

export const viewport: Viewport = {
  themeColor: "#fff6e8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${baloo.variable} ${kalam.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
