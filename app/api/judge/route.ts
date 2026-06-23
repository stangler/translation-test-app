import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";

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
      "HTTP-Referer": "https://translation-test-app.vercel.app",
      "X-Title": "translation-test-app",
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

export async function POST(req: NextRequest) {
  console.log(
    "OPENROUTER_API_KEY:",
    process.env.OPENROUTER_API_KEY?.slice(0, 8),
  );
  const { enQuestion, correct, userRaw } = await req.json();

  const useGemini = !!GEMINI_API_KEY;
  const useOpenRouter = !!OPENROUTER_API_KEY;

  if (!useGemini && !useOpenRouter) {
    return NextResponse.json({ correct: false, byAI: false });
  }

  const prompt = AI_PROMPT(enQuestion, correct, userRaw);
  try {
    const text = useGemini
      ? await callGemini(prompt)
      : await callOpenRouter(prompt);
    const isCorrect = text.startsWith("YES");
    return NextResponse.json({ correct: isCorrect, byAI: isCorrect });
  } catch (e) {
    console.warn("AI API error:", e);
    return NextResponse.json({ correct: false, byAI: false });
  }
}
