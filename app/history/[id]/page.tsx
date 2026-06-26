"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

interface QuizResultItem {
  id: string;
  wordEn: string;
  wordJa: string;
  userAnswer: string;
  correct: boolean;
  byAI: boolean;
}

interface AttemptDetail {
  id: string;
  mode: string;
  lesson: string;
  part: string | null;
  score: number;
  total: number;
  createdAt: string;
  items: QuizResultItem[];
}

export default function HistoryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [attempt, setAttempt] = useState<AttemptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterWrong, setFilterWrong] = useState(false);

  useEffect(() => {
    fetch(`/api/attempts/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        setAttempt(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="note-page">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="note-page">
        <p className="text-red-500">受験記録が見つかりませんでした。</p>
        <button
          onClick={() => router.push("/history")}
          className="text-sm text-blue-500 underline mt-2"
        >
          履歴に戻る
        </button>
      </div>
    );
  }

  const pct = Math.round((attempt.score / attempt.total) * 100);
  const date = new Date(attempt.createdAt).toLocaleString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const displayedItems = filterWrong
    ? attempt.items.filter((i) => !i.correct)
    : attempt.items;

  return (
    <div className="note-page">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/history")}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← 履歴に戻る
        </button>
        <h1 className="text-lg font-bold">受験詳細</h1>
      </div>

      {/* サマリー */}
      <div className="bg-white border border-border rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">
            {attempt.mode === "en2ja" ? "🇬🇧→🇯🇵" : "🇯🇵→🇬🇧"} Lesson{" "}
            {attempt.lesson}
            {attempt.part && ` / Part ${attempt.part}`}
          </div>
          <div className="text-xs text-gray-500">{date}</div>
        </div>
        <div className="flex items-end gap-4">
          <div
            className={`text-3xl font-bold ${pct >= 80 ? "text-green-600" : pct >= 60 ? "text-yellow-600" : "text-red-500"}`}
          >
            {pct}%
          </div>
          <div className="text-sm text-gray-500 mb-1">
            {attempt.score} / {attempt.total} 問正解
          </div>
        </div>
      </div>

      {/* フィルター */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-gray-500">表示:</span>
        <button
          className={`text-xs px-3 py-1 rounded-full border ${!filterWrong ? "bg-red text-white border-red" : "bg-white text-gray-600 border-border"}`}
          onClick={() => setFilterWrong(false)}
        >
          全{attempt.total}問
        </button>
        <button
          className={`text-xs px-3 py-1 rounded-full border ${filterWrong ? "bg-red text-white border-red" : "bg-white text-gray-600 border-border"}`}
          onClick={() => setFilterWrong(true)}
        >
          間違いのみ ({attempt.total - attempt.score}問)
        </button>
      </div>

      {/* 問題一覧 */}
      <div className="space-y-2">
        {displayedItems.map((item) => {
          const q = attempt.mode === "en2ja" ? item.wordEn : item.wordJa;
          const correctAns =
            attempt.mode === "en2ja" ? item.wordJa : item.wordEn;
          const isJaAns = attempt.mode === "en2ja";
          return (
            <div
              key={item.id}
              className={`p-3 rounded-xl border text-[13px] ${
                item.correct
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <div className="text-gray-500 mb-1">{q}</div>
              <div className={item.correct ? "text-green-700" : "text-red-700"}>
                <span className="text-xs">あなたの答え: </span>
                {item.userAnswer || "（未回答）"}
              </div>
              {!item.correct && (
                <div
                  className={`font-semibold mt-1 ${isJaAns ? "ja-text" : "font-mono"}`}
                >
                  正解: {correctAns}
                </div>
              )}
              {item.byAI && (
                <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                  🤖 AI判定
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 再挑戦 */}
      {attempt.items.some((i) => !i.correct) && (
        <div className="mt-6">
          <button
            className="w-full py-2.5 text-sm font-bold text-white bg-red rounded-xl hover:bg-red/90"
            onClick={() => {
              const wrong = attempt.items.filter((i) => !i.correct);
              const data = wrong.map((i) => ({
                lesson: attempt.lesson,
                part: attempt.part || "",
                en: i.wordEn,
                ja: i.wordJa,
                ja_answers: [i.wordJa],
              }));
              // Store wrong items in sessionStorage for the quiz page to pick up
              sessionStorage.setItem("retry-data", JSON.stringify(data));
              sessionStorage.setItem("retry-mode", attempt.mode);
              router.push("/");
            }}
          >
            🔄 間違えた問題を再挑戦 ({attempt.total - attempt.score}問)
          </button>
        </div>
      )}
    </div>
  );
}
