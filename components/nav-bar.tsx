"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export function NavBar() {
  const { data: session } = useSession();
  const router = useRouter();

  if (!session) return null;

  return (
    <nav className="flex items-center justify-between px-5 py-3 border-b border-border bg-white">
      <button
        onClick={() => router.push("/")}
        className="text-sm font-bold text-gray-700 hover:text-red transition-colors"
      >
        📖 英語練習
      </button>
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/history")}
          className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          📊 履歴
        </button>
        <span className="text-xs text-gray-400">{session.user?.email}</span>
        <button
          onClick={() => signOut()}
          className="text-xs text-gray-400 hover:text-red transition-colors"
        >
          ログアウト
        </button>
      </div>
    </nav>
  );
}
