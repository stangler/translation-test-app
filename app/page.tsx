"use client";

import { useState, useEffect, useRef } from "react";

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

// ===== AI フォールバック判定（Gemini / OpenRouter 両対応）=====
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const OPENROUTER_API_KEY = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || "";
const GEMINI_MODEL = process.env.NEXT_PUBLIC_GEMINI_MODEL || "gemini-2.0-flash";
const OPENROUTER_MODEL =
  process.env.NEXT_PUBLIC_OPENROUTER_MODEL || "openai/gpt-4o-mini";

const AI_PROMPT = (enQuestion: string, correct: string, userRaw: string) =>
  `あなたは中学英語の採点者です。以下の生徒の答えが正解と同じ意味かどうか、YES か NO だけ答えてください。
英語の問題: ${enQuestion}
正解の日本語訳: ${correct}
生徒の答え: ${userRaw}
同じ意味ですか？（YES/NO）`;

async function callGemini(prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4, temperature: 0 },
      }),
    },
  );
  const data = await res.json();
  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toUpperCase() ?? ""
  );
}

async function callOpenRouter(prompt: string): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0,
    }),
  });
  const data = await res.json();
  const msg = data?.choices?.[0]?.message;
  let text = Array.isArray(msg?.content)
    ? (msg.content.find((b: any) => b.type === "text")?.text ?? "")
    : (msg?.content ?? "");
  if (!text && msg?.reasoning) {
    const m = msg.reasoning.match(/(YES|NO)/i);
    text = m ? m[1] : "";
  }
  return text.trim().toUpperCase();
}

const matchJa = (userRaw: string, answers: string[]): boolean => {
  const user = userRaw.trim().toLowerCase();
  return answers.some((ans) => ans.trim().toLowerCase() === user);
};

async function matchJaWithAI(
  userRaw: string,
  answers: string[],
  enQuestion: string,
): Promise<{ correct: boolean; byAI: boolean }> {
  if (matchJa(userRaw, answers)) return { correct: true, byAI: false };

  const useGemini = !!GEMINI_API_KEY;
  const useOpenRouter = !!OPENROUTER_API_KEY;
  if (!useGemini && !useOpenRouter) return { correct: false, byAI: false };

  const apiName = useGemini
    ? `Gemini(${GEMINI_MODEL})`
    : `OpenRouter(${OPENROUTER_MODEL})`;
  const prompt = AI_PROMPT(enQuestion, answers[0], userRaw);
  try {
    const text = useGemini
      ? await callGemini(prompt)
      : await callOpenRouter(prompt);
    const correct = text.startsWith("YES");
    console.log(
      `[AI判定] ${apiName} → ${text} | user="${userRaw}" ans="${answers[0]}"`,
    );
    return { correct, byAI: correct };
  } catch (e) {
    console.warn("AI API error:", e);
    return { correct: false, byAI: false };
  }
}

export default function Home() {
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
    // words-data.jsonを読み込み
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
    setScreen("quiz");
  };

  const normalizeEn = (text: string): string => {
    return text.toLowerCase().normalize("NFKC").replace(/'/g, "").trim();
  };

  const compareWords = (user: string, correct: string): boolean => {
    const userNorm = normalizeEn(user);
    const ansNorm = normalizeEn(correct);
    return userNorm === ansNorm;
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

    // フィードバックデータ構築
    let answerText = "";
    let altAnswers = "";
    if (mode === "en2ja") {
      answerText = item.ja_answers[0];
      altAnswers = item.ja_answers.length > 1 ? `別解: ${item.ja_answers.slice(1).join(" / ")}` : "";
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

    // inputスタイルのみDOM直接操作
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
    setScreen("quiz");
  };

  const goToStart = () => {
    setScreen("start");
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
              <svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg" width="56" height="56">
                <circle cx="28" cy="28" r="22" className="circle-path"/>
              </svg>
            )}
            {state.markResult === false && (
              <svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg" width="56" height="56">
                <line x1="12" y1="12" x2="44" y2="44" className="cross-path1"/>
                <line x1="44" y1="12" x2="12" y2="44" className="cross-path2"/>
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
                <span style={{display:"inline-block",marginLeft:"8px",padding:"1px 7px",borderRadius:"10px",fontSize:"11px",fontWeight:"bold",background:"#e8f4ff",color:"#3a7bd5",border:"1px solid #b0d0f0",verticalAlign:"middle"}}>
                  🤖 AI判定
                </span>
              )}
            </div>
            <div className="feedback-answer ja-text">{state.feedback.answerText}</div>
            {state.feedback.altAnswers && (
              <div className="feedback-all-answers">{state.feedback.altAnswers}</div>
            )}
          </div>
        )}

        <div className="action-row flex gap-2.5">
          {!state.isAnswered && (
            <button className="check-btn" style={{flex:1}} onClick={checkAnswer}>
              判定
            </button>
          )}
          {state.isAnswered && (
            <button className="next-btn show" style={{flex:1}} onClick={nextQuestion}>
              {state.currentIndex === state.queue.length - 1 ? "結果を見る" : "次へ →"}
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
