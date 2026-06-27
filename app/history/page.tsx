"use client";

import { useEffect, useState, useMemo } from "react";
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
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/attempts")
      .then((res) => res.json())
      .then((data) => {
        setAttempts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ユニークなレッスン一覧
  const lessons = useMemo(() => {
    const seen = new Set<string>();
    return attempts.filter((a) => {
      if (seen.has(a.lesson)) return false;
      seen.add(a.lesson);
      return true;
    }).map((a) => a.lesson);
  }, [attempts]);

  // 選択中のレッスンに含まれるユニークなパート一覧
  const parts = useMemo(() => {
    if (!selectedLesson) return [];
    const seen = new Set<string>();
    return attempts
      .filter((a) => a.lesson === selectedLesson && a.part)
      .filter((a) => {
        const key = a.part!;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((a) => a.part!);
  }, [attempts, selectedLesson]);

  // フィルター後の attempts
  const filtered = useMemo(() => {
    let result = [...attempts];
    if (selectedLesson) {
      result = result.filter((a) => a.lesson === selectedLesson);
    }
    if (selectedPart) {
      result = result.filter((a) => a.part === selectedPart);
    }
    return result;
  }, [attempts, selectedLesson, selectedPart]);

  // グラフ用（古い順）
  const reversed = useMemo(() => [...filtered].reverse(), [filtered]);

  const handleSelectLesson = (lesson: string | null) => {
    setSelectedLesson(lesson);
    setSelectedPart(null);
  };

  const handleSelectPart = (part: string | null) => {
    setSelectedPart(part);
  };

  const graphWidth = Math.max(reversed.length * 60, 200);
  const graphHeight = 200;
  if (loading) {
    return (
      <div className="note-page">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="note-page">
      <div className="flex items-center gap-3 mb-4">
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
          {/* ── Lesson フィルター ── */}
          <div className="mb-3">
            <div className="text-xs font-bold text-gray-500 mb-2">
              レッスンで絞り込む
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  selectedLesson === null
                    ? "bg-red text-white border-red"
                    : "bg-white text-gray-600 border-border hover:border-red/30"
                }`}
                onClick={() => handleSelectLesson(null)}
              >
                すべて
              </button>
              {lessons.map((lesson) => (
                <button
                  key={lesson}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    selectedLesson === lesson
                      ? "bg-red text-white border-red"
                      : "bg-white text-gray-600 border-border hover:border-red/30"
                  }`}
                  onClick={() => handleSelectLesson(lesson)}
                >
                  {lesson === "Starter" ? "Starter" : `Lesson ${lesson}`}
                </button>
              ))}
            </div>
          </div>

          {/* ── Part フィルター ── */}
          {selectedLesson && parts.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-bold text-gray-500 mb-2">
                パートで絞り込む
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    selectedPart === null
                      ? "bg-red text-white border-red"
                      : "bg-white text-gray-600 border-border hover:border-red/30"
                  }`}
                  onClick={() => handleSelectPart(null)}
                >
                  すべて
                </button>
                {parts.map((part) => (
                  <button
                    key={part}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      selectedPart === part
                        ? "bg-red text-white border-red"
                        : "bg-white text-gray-600 border-border hover:border-red/30"
                    }`}
                    onClick={() => handleSelectPart(part)}
                  >
                    {part}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── フィルター情報表示 ── */}
          <div className="text-xs text-gray-400 mb-3">
            {filtered.length} 件の記録
            {selectedLesson && ` ／ ${selectedLesson === "Starter" ? "Starter" : `Lesson ${selectedLesson}`}`}
            {selectedPart && ` ／ ${selectedPart}`}
          </div>

          {/* ── 正解率推移グラフ ── */}
          {filtered.length >= 2 && (
            <div className="mb-8">
              <h2 className="text-sm font-bold text-gray-600 mb-3">
                正解率の推移
              </h2>
              <div className="bg-white border border-border rounded-xl p-4">
                <svg
                  viewBox={`0 0 ${graphWidth} ${graphHeight}`}
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

                  {/* ドット + ラベル */}
                  {reversed.map((a, i) => {
                    const x = i * 60 + 30;
                    const y = 190 - (a.score / a.total) * 160;
                    const pct = Math.round((a.score / a.total) * 100);
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
                          {pct}%
                        </text>
                        {reversed.length <= 15 && (
                          <text
                            x={x}
                            y={graphHeight - 5}
                            fontSize="8"
                            textAnchor="middle"
                            fill="#aaa"
                          >
                            {new Date(a.createdAt).toLocaleDateString("ja-JP", {
                              month: "numeric",
                              day: "numeric",
                            })}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          )}

          {filtered.length === 1 && (
            <div className="mb-8 text-sm text-gray-500 bg-gray-50 border border-border rounded-xl p-4 text-center">
              グラフを表示するには2件以上の記録が必要です。
            </div>
          )}

          {/* ── 履歴一覧 ── */}
          <h2 className="text-sm font-bold text-gray-600 mb-3">受験記録</h2>
          <div className="space-y-2">
            {filtered.map((a) => {
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
                        {a.part && ` / ${a.part}`}
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
