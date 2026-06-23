import type { Metadata } from "next";
import { Zen_Maru_Gothic, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/auth/session-provider";
import { auth } from "@/auth";

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session = null;
  try {
    session = await auth();
  } catch (e) {
    console.warn("auth() failed during build:", e);
  }
  return (
    <html lang="ja">
      <body className={`${zenMaruGothic.variable} ${jetBrainsMono.variable}`}>
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  );
}
