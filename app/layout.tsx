import type { Metadata } from "next";
import { Zen_Maru_Gothic, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

const zenMaruGothic = Zen_Maru_Gothic({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--sans",
});

const jetBrainsMono = JetBrains_Mono({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--mono",
});

export const metadata: Metadata = {
  title: "英語練習テスト",
  description: "EIGO NO PARTNER - 英語学習アプリ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={`${zenMaruGothic.variable} ${jetBrainsMono.variable}`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
