"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Mode = "en2ja" | "ja2en";

interface Word {
  lesson: string;
  part: string;
  en: string;
  ja: string;
  ja_answers: string[];
}

interface FeedbackData {
  answerText: string;
  altAnswers: string;
  byAI: boolean;
}

interface QuizState {
  mode: Mode;
  selectedLesson: string | null;
  selectedPart: string | null;
  queue: Word[];
  currentIndex: number;
  results: Array<{
    item: Word;
    correct: boolean;
    userAnswer: string;
    byAI: boolean;
  }>;
  isAnswered: boolean;
  lessons: string[];
  parts: string[];
  feedback: FeedbackData | null;
  markResult: boolean | null;
}

const matchJa = (userRaw: string, answers: string[]): boolean => {
  const normalize = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[。、．，]/g, "");
  const user = normalize(userRaw);
  return answers.some((ans) => normalize(ans) === user);
};

async function matchJaWithAI(
  userRaw: string,
  answers: string[],
  enQuestion: string,
): Promise<{ correct: boolean; byAI: boolean }> {
  if (matchJa(userRaw, answers)) return { correct: true, byAI: false };

  try {
    const res = await fetch("/api/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enQuestion, correct: answers[0], userRaw }),
    });
    const data = await res.json();
    return { correct: data.correct, byAI: data.byAI };
  } catch (e) {
    console.warn("AI API error:", e);
    return { correct: false, byAI: false };
  }
}

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();
  const [wordsData, setWordsData] = useState<Word[]>([]);
  const [state, setState] = useState<QuizState>({
    mode: "en2ja",
    selectedLesson: null,
    selectedPart: null,
    queue: [],
    currentIndex: 0,
    results: [],
    isAnswered: false,
    lessons: [],
    parts: [],
    feedback: null,
    markResult: null,
  });

  const [screen, setScreen] = useState<"start" | "quiz" | "result">("start");
  const isAnsweredRef = useRef(false);

  useEffect(() => {
    fetch("/words-data.json")
      .then((res) => res.json())
      .then((data: Word[]) => {
        setWordsData(data);
        const lessons: string[] = [...new Set(data.map((d) => d.lesson))];
        setState((prev) => ({ ...prev, lessons }));
      })
      .catch((err) => console.error("Failed to load words data:", err));
  }, []);

  const selectMode = (mode: Mode) => {
    setState((prev) => ({ ...prev, mode }));
  };

  const selectLesson = (lesson: string) => {
    const parts = [
      ...new Set(
        wordsData
          .filter((d) => d.lesson === lesson && d.part !== "")
          .map((d) => d.part),
      ),
    ];
    setState((prev) => ({
      ...prev,
      selectedLesson: lesson,
      selectedPart: "all",
      parts,
    }));
  };

  const selectPart = (part: string) => {
    setState((prev) => ({
      ...prev,
      selectedPart: part === "all" ? "all" : part,
    }));
  };

  const startQuiz = (shuffle: boolean) => {
    let items = wordsData.filter((d) => d.lesson === state.selectedLesson);
    if (state.selectedPart && state.selectedPart !== "all") {
      items = items.filter((d) => d.part === state.selectedPart);
    }

    if (shuffle) {
      items = [...items].sort(() => Math.random() - 0.5);
    }

    setState((prev) => ({
      ...prev,
      queue: items,
      currentIndex: 0,
      results: [],
      isAnswered: false,
      feedback: null,
      markResult: null,
    }));
    isAnsweredRef.current = false;
    setSaved(false);
    setScreen("quiz");
  };

  const CONTRACTIONS_MAP: Record<string, string> = {
    "don't": "do not",
    "doesn't": "does not",
    "didn't": "did not",
    "isn't": "is not",
    "aren't": "are not",
    "wasn't": "was not",
    "weren't": "were not",
    "haven't": "have not",
    "hasn't": "has not",
    "hadn't": "had not",
    "won't": "will not",
    "wouldn't": "would not",
    "can't": "cannot",
    "couldn't": "could not",
    "shouldn't": "should not",
    "mustn't": "must not",
    "needn't": "need not",
    "i'm": "i am",
    "you're": "you are",
    "he's": "he is",
    "she's": "she is",
    "it's": "it is",
    "we're": "we are",
    "they're": "they are",
    "i've": "i have",
    "you've": "you have",
    "we've": "we have",
    "they've": "they have",
    "i'll": "i will",
    "you'll": "you will",
    "he'll": "he will",
    "she'll": "she will",
    "it'll": "it will",
    "we'll": "we will",
    "they'll": "they will",
    "let's": "let us",
  };

  const expandContractions = (text: string): string => {
    const lower = text.toLowerCase();
    // Build a regex that matches any contraction (longest first to avoid partial matches)
    const contractions = Object.keys(CONTRACTIONS_MAP).sort(
      (a, b) => b.length - a.length,
    );
    const regex = new RegExp(`\\b(${contractions.join("|")})\\b`, "gi");
    return lower.replace(regex, (match) => CONTRACTIONS_MAP[match.toLowerCase()]);
  };

  const normalizeEn = (text: string): string => {
    return expandContractions(text)
      .normalize("NFKC")
      .replace(/'/g, "")
      .trim();
  };

  const compareWords = (user: string, correct: string): boolean => {
    return normalizeEn(user) === normalizeEn(correct);
  };

  const checkAnswer = async () => {
    if (state.isAnswered) return;

    const item = state.queue[state.currentIndex];
    const input = document.getElementById("answer-input") as HTMLInputElement;
    const userRaw = input.value.trim();
    const mode = state.mode;

    let correct = false;
    let byAI = false;

    if (mode === "en2ja") {
      const aiResult = await matchJaWithAI(userRaw, item.ja_answers, item.en);
      correct = aiResult.correct;
      byAI = aiResult.byAI;
    } else {
      correct = compareWords(userRaw, item.en);
    }

    let answerText = "";
    let altAnswers = "";
    if (mode === "en2ja") {
      answerText = item.ja_answers[0];
      altAnswers =
        item.ja_answers.length > 1
          ? `別解: ${item.ja_answers.slice(1).join(" / ")}`
          : "";
    } else {
      answerText = item.en;
      altAnswers = "";
    }

    setState((prev) => ({
      ...prev,
      isAnswered: true,
      results: [...prev.results, { item, correct, userAnswer: userRaw, byAI }],
      feedback: { answerText, altAnswers, byAI },
      markResult: correct,
    }));
    isAnsweredRef.current = true;

    input.readOnly = true;
    input.classList.add(correct ? "correct" : "wrong");
  };

  const nextQuestion = () => {
    if (state.currentIndex === state.queue.length - 1) {
      setScreen("result");
    } else {
      setState((prev) => ({
        ...prev,
        currentIndex: prev.currentIndex + 1,
        isAnswered: false,
        feedback: null,
        markResult: null,
      }));
      isAnsweredRef.current = false;
    }
  };

  const retryMistakes = () => {
    const mistakes = state.results.filter((r) => !r.correct);
    const newQueue = mistakes.map((r) => r.item);
    setState((prev) => ({
      ...prev,
      queue: newQueue,
      currentIndex: 0,
      results: [],
      isAnswered: false,
      feedback: null,
      markResult: null,
    }));
    isAnsweredRef.current = false;
    setSaved(false);
    setScreen("quiz");
  };

  const retryAll = () => {
    const newQueue = [...state.queue].sort(() => Math.random() - 0.5);
    setState((prev) => ({
      ...prev,
      queue: newQueue,
      currentIndex: 0,
      results: [],
      isAnswered: false,
      feedback: null,
      markResult: null,
    }));
    isAnsweredRef.current = false;
    setSaved(false);
    setScreen("quiz");
  };

  const goToStart = () => {
    setScreen("start");
  };

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const saveResult = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      const results = state.results.map((r) => ({
        wordEn: r.item.en,
        wordJa: r.item.ja,
        userAnswer: r.userAnswer,
        correct: r.correct,
        byAI: r.byAI,
      }));
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: state.mode,
          lesson: state.selectedLesson,
          part: state.selectedPart === "all" ? null : state.selectedPart,
          results,
        }),
      });
      if (res.ok) {
        setSaved(true);
      }
    } catch (e) {
      console.warn("Failed to save result:", e);
    } finally {
      setSaving(false);
    }
  };

  if (screen === "quiz" && state.queue.length > 0) {
    const item = state.queue[state.currentIndex];

    return (
      <div className="note-page">
        <div className="quiz-header flex justify-between items-center mb-5">
          <div className="quiz-progress text-[13px] text-gray-500">
            {state.currentIndex + 1} / {state.queue.length}
          </div>
          <div className="quiz-mode-badge text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue text-white">
            {state.mode === "en2ja" ? "英→日" : "日→英"}
          </div>
        </div>

        <div className="progress-bar-wrap w-full h-1.5 bg-border rounded mb-7 overflow-hidden">
          <div
            className="progress-bar-fill h-full bg-red rounded transition-all"
            style={{
              width: `${(state.currentIndex / state.queue.length) * 100}%`,
            }}
          />
        </div>

        <div className="question-card bg-bg border border-border rounded-xl p-6 mb-5 relative">
          <div className="question-label text-[11px] font-bold text-gray-400 tracking-wider mb-2">
            {state.mode === "en2ja" ? "英語" : "日本語"}
          </div>
          <div
            className={`question-text text-[20px] font-bold leading-relaxed ${state.mode === "en2ja" ? "en-text font-mono" : ""}`}
          >
            {state.mode === "en2ja" ? item.en : item.ja}
          </div>
          <div
            style={{
              position: "absolute",
              top: "12px",
              right: "16px",
              width: "56px",
              height: "56px",
            }}
          >
            {state.markResult === true && (
              <svg
                viewBox="0 0 56 56"
                xmlns="http://www.w3.org/2000/svg"
                width="56"
                height="56"
              >
                <circle cx="28" cy="28" r="22" className="circle-path" />
              </svg>
            )}
            {state.markResult === false && (
              <svg
                viewBox="0 0 56 56"
                xmlns="http://www.w3.org/2000/svg"
                width="56"
                height="56"
              >
                <line x1="12" y1="12" x2="44" y2="44" className="cross-path1" />
                <line x1="44" y1="12" x2="12" y2="44" className="cross-path2" />
              </svg>
            )}
          </div>
        </div>

        <div className="answer-area mb-4">
          <input
            key={state.currentIndex}
            id="answer-input"
            type="text"
            className="answer-input"
            placeholder={
              state.mode === "en2ja"
                ? "日本語で答えてください…"
                : "Type in English…"
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (!isAnsweredRef.current) {
                  checkAnswer();
                } else {
                  nextQuestion();
                }
              }
            }}
            readOnly={state.isAnswered}
            autoFocus
          />
        </div>

        {state.feedback && (
          <div className="feedback show">
            <div className="feedback-correct-label">
              ✏️ 正解
              {state.feedback.byAI && (
                <span
                  style={{
                    display: "inline-block",
                    marginLeft: "8px",
                    padding: "1px 7px",
                    borderRadius: "10px",
                    fontSize: "11px",
                    fontWeight: "bold",
                    background: "#e8f4ff",
                    color: "#3a7bd5",
                    border: "1px solid #b0d0f0",
                    verticalAlign: "middle",
                  }}
                >
                  🤖 AI判定
                </span>
              )}
            </div>
            <div className="feedback-answer ja-text">
              {state.feedback.answerText}
            </div>
            {state.feedback.altAnswers && (
              <div className="feedback-all-answers">
                {state.feedback.altAnswers}
              </div>
            )}
          </div>
        )}

        <div className="action-row flex gap-2.5">
          {!state.isAnswered && (
            <button
              className="check-btn"
              style={{ flex: 1 }}
              onClick={checkAnswer}
            >
              判定
            </button>
          )}
          {state.isAnswered && (
            <button
              className="next-btn show"
              style={{ flex: 1 }}
              onClick={nextQuestion}
            >
              {state.currentIndex === state.queue.length - 1
                ? "結果を見る"
                : "次へ →"}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (screen === "result") {
    const total = state.results.length;
    const correct = state.results.filter((r) => r.correct).length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const mistakes = state.results.filter((r) => !r.correct);

    return (
      <div className="note-page">
        <div className="result-title text-2xl font-bold mb-1.5">テスト結果</div>
        <div className="result-score text-5xl font-bold text-red leading-none my-4">
          {pct}%
        </div>
        <div className="result-score-label text-sm text-gray-500 mb-3">
          {correct} / {total} 問正解
        </div>

        <div className="result-message bg-bg rounded-xl border-l-4 border-gold p-4 mb-6">
          {pct === 100
            ? "完璧です！素晴らしい！"
            : pct >= 80
              ? "よくできました！"
              : pct >= 60
                ? "もう少し頑張りましょう"
                : "復習をおすすめします"}
        </div>

        {mistakes.length > 0 && (
          <div className="mistakes-section mb-6">
            <div className="mistakes-title text-[13px] font-bold text-red tracking-wider mb-3">
              ✏️ 間違えた問題 ({mistakes.length}問)
            </div>
            {mistakes.map((r, idx) => {
              const q = state.mode === "en2ja" ? r.item.en : r.item.ja;
              const correctAns =
                state.mode === "en2ja" ? r.item.ja_answers[0] : r.item.en;
              const isJaAns = state.mode === "en2ja";
              return (
                <div
                  key={idx}
                  className="mistake-item p-3 bg-bg border-l-3 border-red rounded-r-lg mb-2 text-[13px]"
                >
                  <div className="mistake-q text-gray-500 mb-1">{q}</div>
                  <div className="mistake-your text-red text-xs mb-1">
                    あなたの答え: {r.userAnswer || "（未回答）"}
                  </div>
                  <div
                    className={`mistake-correct font-mono text-sm font-semibold ${isJaAns ? "ja-text" : ""}`}
                  >
                    正解: {correctAns}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="result-btns flex flex-col gap-2.5">
          {session && !saved && (
            <button
              className="result-btn primary"
              onClick={saveResult}
              disabled={saving}
            >
              {saving ? "保存中..." : "💾 結果を保存"}
            </button>
          )}
          {session && saved && (
            <div className="text-center text-sm text-green-600 mb-1">
              ✅ 結果を保存しました
            </div>
          )}
          <button
            className="result-btn primary"
            onClick={retryMistakes}
            style={{ display: mistakes.length > 0 ? "block" : "none" }}
          >
            間違いのみ再挑戦
          </button>
          <button className="result-btn" onClick={retryAll}>
            全部再挑戦
          </button>
          <button className="result-btn" onClick={goToStart}>
            選択に戻る
          </button>
          {session && (
            <button
              className="result-btn"
              onClick={() => router.push("/history")}
            >
              📊 履歴を見る
            </button>
          )}
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
        EIGO NO PARTNER
      </div>

      <div className="section-label text-[12px] font-bold text-red uppercase tracking-wider mb-2.5">
        モードを選ぶ
      </div>
      <div className="mode-buttons grid grid-cols-2 gap-2.5 mb-1.5">
        <button
          className={`mode-btn ${state.mode === "en2ja" ? "selected" : ""}`}
          onClick={() => selectMode("en2ja")}
        >
          <span className="mode-icon text-[22px] block mb-1">🇬🇧→🇯🇵</span>
          英→日
          <br />
          <small style={{ fontSize: "11px", fontWeight: 400 }}>
            英語を見て日本語で答える
          </small>
        </button>
        <button
          className={`mode-btn ${state.mode === "ja2en" ? "selected" : ""}`}
          onClick={() => selectMode("ja2en")}
        >
          <span className="mode-icon text-[22px] block mb-1">🇯🇵→🇬🇧</span>
          日→英
          <br />
          <small style={{ fontSize: "11px", fontWeight: 400 }}>
            日本語を見て英語で答える
          </small>
        </button>
      </div>

      <div className="section-label text-[12px] font-bold text-red uppercase tracking-wider mb-2.5 mt-5">
        レッスンを選ぶ
      </div>
      <div className="lesson-grid flex flex-wrap gap-2 mb-1">
        {state.lessons.map((lesson) => (
          <button
            key={lesson}
            className={`lesson-btn ${state.selectedLesson === lesson ? "selected" : ""}`}
            onClick={() => selectLesson(lesson)}
          >
            {lesson === "Starter" ? "Starter" : `Lesson ${lesson}`}
          </button>
        ))}
      </div>

      {state.selectedLesson && state.parts.length > 0 && (
        <div id="part-section" className="mt-5">
          <div className="section-label text-[12px] font-bold text-red uppercase tracking-wider mb-2.5">
            パートを選ぶ
          </div>
          <div className="part-row flex flex-wrap gap-2">
            <button
              className={`part-btn ${state.selectedPart === "all" ? "selected" : ""}`}
              onClick={() => selectPart("all")}
            >
              すべて
            </button>
            {state.parts.map((part) => (
              <button
                key={part}
                className={`part-btn ${state.selectedPart === part ? "selected" : ""}`}
                onClick={() => selectPart(part)}
              >
                Part {part}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="option-row flex items-center gap-2.5 mt-5 mb-6">
        <label className="toggle-label flex items-center gap-2 text-[13px] cursor-pointer">
          <input
            type="checkbox"
            id="shuffle-check"
            defaultChecked
            className="w-4 h-4 accent-red"
          />
          シャッフルする
        </label>
      </div>

      <button
        id="start-btn"
        className="start-btn"
        disabled={state.selectedLesson === null}
        onClick={() => {
          const shuffle = (
            document.getElementById("shuffle-check") as HTMLInputElement
          ).checked;
          startQuiz(shuffle);
        }}
      >
        開始
      </button>
    </div>
  );
}
