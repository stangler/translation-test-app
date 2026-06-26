import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { mode, lesson, part, results } = await req.json();

  if (!mode || !lesson || !Array.isArray(results)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const score = results.filter((r: any) => r.correct).length;
  const total = results.length;

  const attempt = await prisma.quizAttempt.create({
    data: {
      userId: user.id,
      mode,
      lesson,
      part: part || null,
      score,
      total,
      items: {
        create: results.map((r: any) => ({
          wordEn: r.wordEn,
          wordJa: r.wordJa,
          userAnswer: r.userAnswer,
          correct: r.correct,
          byAI: r.byAI ?? false,
        })),
      },
    },
    include: { items: true },
  });

  return NextResponse.json(attempt, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const attempts = await prisma.quizAttempt.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  return NextResponse.json(attempts);
}
