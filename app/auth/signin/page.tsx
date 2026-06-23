"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.includes("@")) {
      setError("有効なメールアドレスを入力してください。");
      return;
    }

    try {
      const result = await signIn("resend", {
        email,
        redirect: false,
        callbackUrl: "/",
      });

      if (result?.error) {
        setError("メールの送信に失敗しました。もう一度お試しください。");
      } else {
        setSent(true);
      }
    } catch {
      setError("エラーが発生しました。もう一度お試しください。");
    }
  };

  if (sent) {
    return (
      <div className="note-page">
        <div className="app-title text-[22px] font-bold mb-1">
          📧 メールを確認してください
        </div>
        <div className="app-subtitle text-[13px] text-gray-500 mb-7">
          ログインリンクを <strong>{email}</strong> に送信しました。
        </div>
        <div className="feedback show">
          <div className="feedback-correct-label">✉️ メールが届かない場合</div>
          <div
            className="feedback-answer"
            style={{ fontSize: "13px", color: "#555" }}
          >
            迷惑メールフォルダを確認するか、もう一度入力してください。
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="note-page">
      <div className="app-title text-[22px] font-bold mb-1">
        📖 英語練習テスト
      </div>
      <div className="app-subtitle text-[13px] text-gray-500 mb-7">
        メールアドレスでログイン
      </div>

      <form onSubmit={handleSubmit}>
        <div className="section-label text-[12px] font-bold text-red uppercase tracking-wider mb-2.5">
          メールアドレス
        </div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="answer-input"
          required
          autoFocus
        />
        {error && <div className="text-red text-[13px] mt-2">{error}</div>}
        <div className="action-row flex gap-2.5 mt-5">
          <button type="submit" className="check-btn" style={{ flex: 1 }}>
            ログインリンクを送信
          </button>
        </div>
      </form>
    </div>
  );
}
