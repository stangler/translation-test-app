"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface AttemptSummary {
  id: string;
  mode: string;
  lesson: string;
  part: string | null;
  score: number;
  total: number;
  createdAt: string;
  _count: { items: number };
}

export default function HistoryPage() {
  const router = useRouter();
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/attempts")
      .then((res) => res.json())
      .then((data) => {
        setAttempts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="note-page">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  const reversed = [...attempts].reverse();
  const maxPct = Math.max(
    ...reversed.map((a) => (a.score / a.total) * 100),
    100,
  );

  return (
    <div className="note-page">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/")}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← 戻る
        </button>
        <h1 className="text-xl font-bold">📊 学習履歴</h1>
      </div>

      {attempts.length === 0 ? (
        <p className="text-gray-500">
          まだ履歴がありません。クイズを受けて結果を保存してください。
        </p>
      ) : (
        <>
          {/* 正解率推移グラフ */}
          <div className="mb-8">
            <h2 className="text-sm font-bold text-gray-600 mb-3">
              正解率の推移
            </h2>
            <div className="bg-white border border-border rounded-xl p-4">
              <svg
                viewBox={`0 0 ${Math.max(reversed.length * 60, 200)} 200`}
                className="w-full h-auto"
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Y軸ラベル */}
                <text x="0" y="20" fontSize="10" fill="#999">
                  100%
                </text>
                <text x="0" y="110" fontSize="10" fill="#999">
                  50%
                </text>
                <text x="0" y="195" fontSize="10" fill="#999">
                  0%
                </text>

                {/* 折れ線 */}
                <polyline
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={reversed
                    .map((a, i) => {
                      const x = i * 60 + 30;
                      const y = 190 - (a.score / a.total) * 160;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                />

                {/* ドット */}
                {reversed.map((a, i) => {
                  const x = i * 60 + 30;
                  const y = 190 - (a.score / a.total) * 160;
                  return (
                    <g key={a.id}>
                      <circle cx={x} cy={y} r="4" fill="#ef4444" />
                      <text
                        x={x}
                        y={y - 10}
                        fontSize="10"
                        textAnchor="middle"
                        fill="#666"
                      >
                        {Math.round((a.score / a.total) * 100)}%
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* 履歴一覧 */}
          <h2 className="text-sm font-bold text-gray-600 mb-3">受験記録</h2>
          <div className="space-y-2">
            {attempts.map((a) => {
              const pct = Math.round((a.score / a.total) * 100);
              const date = new Date(a.createdAt).toLocaleString("ja-JP", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <button
                  key={a.id}
                  onClick={() => router.push(`/history/${a.id}`)}
                  className="w-full text-left p-3 bg-white border border-border rounded-xl hover:border-red/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">
                        {a.mode === "en2ja" ? "🇬🇧→🇯🇵" : "🇯🇵→🇬🇧"} Lesson{" "}
                        {a.lesson}
                        {a.part && ` / Part ${a.part}`}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{date}</div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-lg font-bold ${pct >= 80 ? "text-green-600" : pct >= 60 ? "text-yellow-600" : "text-red-500"}`}
                      >
                        {pct}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {a.score}/{a.total}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
