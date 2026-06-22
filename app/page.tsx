'use client'

import { useState, useEffect, useRef } from 'react'

type Mode = 'en2ja' | 'ja2en'

interface Word {
  lesson: string
  part: string
  en: string
  ja: string[]
}

interface QuizState {
  mode: Mode
  selectedLesson: string | null
  selectedPart: string | null
  queue: Word[]
  currentIndex: number
  results: Array<{ item: Word; correct: boolean; userAnswer: string; byAI: boolean }>
  isAnswered: boolean
  kuromojiReady: boolean
  lessons: string[]
  parts: string[]
}

export default function Home() {
  const [wordsData, setWordsData] = useState<Word[]>([])
  const [state, setState] = useState<QuizState>({
    mode: 'en2ja',
    selectedLesson: null,
    selectedPart: null,
    queue: [],
    currentIndex: 0,
    results: [],
    isAnswered: false,
    kuromojiReady: false,
    lessons: [],
    parts: [],
  })

  const [screen, setScreen] = useState<'start' | 'quiz' | 'result'>('start')
  const tokenizerRef = useRef<any>(null)

  useEffect(() => {
    // words-data.jsonを読み込み
    fetch('/words-data.json')
      .then(res => res.json())
      .then((data: Word[]) => {
        setWordsData(data)
        const lessons: string[] = [...new Set(data.map(d => d.lesson))]
        setState(prev => ({ ...prev, lessons }))
      })
      .catch(err => console.error('Failed to load words data:', err))
  }, [])

  useEffect(() => {
    // kuromoji初期化
    const initKuromoji = async () => {
      try {
        const kuromoji = require('kuromoji')
        kuromoji.builder({ dicPath: 'https://unpkg.com/kuromoji@0.1.2/dict' }).build((err: any, built: any) => {
          if (!err) {
            tokenizerRef.current = built
            setState(prev => ({ ...prev, kuromojiReady: true }))
          } else {
            console.warn('kuromoji初期化失敗:', err)
            setState(prev => ({ ...prev, kuromojiReady: true }))
          }
        })
      } catch (e) {
        console.warn('kuromoji load error:', e)
        setState(prev => ({ ...prev, kuromojiReady: true }))
      }
    }
    initKuromoji()
  }, [])

  const selectMode = (mode: Mode) => {
    setState(prev => ({ ...prev, mode }))
  }

  const selectLesson = (lesson: string) => {
    const parts = [...new Set(
      wordsData.filter(d => d.lesson === lesson && d.part !== '').map(d => d.part)
    )]
    setState(prev => ({ 
      ...prev, 
      selectedLesson: lesson, 
      selectedPart: 'all',
      parts 
    }))
  }

  const selectPart = (part: string) => {
    setState(prev => ({ ...prev, selectedPart: part === 'all' ? 'all' : part }))
  }

  const startQuiz = (shuffle: boolean) => {
    let items = wordsData.filter(d => d.lesson === state.selectedLesson)
    if (state.selectedPart && state.selectedPart !== 'all') {
      items = items.filter(d => d.part === state.selectedPart)
    }

    if (shuffle) {
      items = [...items].sort(() => Math.random() - 0.5)
    }

    setState(prev => ({ 
      ...prev, 
      queue: items, 
      currentIndex: 0, 
      results: [], 
      isAnswered: false 
    }))
    setScreen('quiz')
  }

  const normalizeEn = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFKC')
      .replace(/'/g, '')
      .trim()
  }

  const compareWords = (user: string, correct: string): boolean => {
    const userNorm = normalizeEn(user)
    const ansNorm = normalizeEn(correct)
    return userNorm === ansNorm
  }

  const matchJa = (userRaw: string, answers: string[]): boolean => {
    const user = userRaw.trim().toLowerCase()
    return answers.some(ans => 
      ans.trim().toLowerCase() === user
    )
  }

  const checkAnswer = async () => {
    if (state.isAnswered) return

    const item = state.queue[state.currentIndex]
    const input = document.getElementById('answer-input') as HTMLInputElement
    const userRaw = input.value.trim()
    const mode = state.mode

    let correct = false
    let byAI = false

    if (mode === 'en2ja') {
      correct = matchJa(userRaw, item.ja)
    } else {
      correct = compareWords(userRaw, item.en)
    }

    setState(prev => ({
      ...prev,
      isAnswered: true,
      results: [...prev.results, { item, correct, userAnswer: userRaw, byAI }]
    }))

    // UI更新
    input.readOnly = true
    input.classList.add(correct ? 'correct' : 'wrong')
    showMark(correct)
    showFeedback(item, mode, correct, byAI)

    const checkBtn = document.getElementById('check-btn')
    const nextBtn = document.getElementById('next-btn')
    if (checkBtn) checkBtn.style.display = 'none'
    if (nextBtn) {
      nextBtn.classList.add('show')
      if (state.currentIndex === state.queue.length - 1) {
        nextBtn.textContent = '結果を見る'
      } else {
        nextBtn.textContent = '次へ →'
      }
    }
  }

  const showFeedback = (item: Word, mode: Mode, correct: boolean, byAI: boolean) => {
    const fb = document.getElementById('feedback')
    const fbAns = document.getElementById('feedback-answer')
    const fbAll = document.getElementById('feedback-all-answers')
    
    if (!fb || !fbAns) return

    // AIバッジ
    let badge = document.getElementById('ai-badge')
    if (!badge) {
      badge = document.createElement('span')
      badge.id = 'ai-badge'
      badge.style.cssText = 'display:inline-block;margin-left:8px;padding:1px 7px;border-radius:10px;font-size:11px;font-weight:bold;background:#e8f4ff;color:#3a7bd5;border:1px solid #b0d0f0;vertical-align:middle;'
    }
    badge.textContent = byAI ? '🤖 AI判定' : ''
    badge.style.display = byAI ? 'inline-block' : 'none'

    if (mode === 'en2ja') {
      fbAns.textContent = item.ja[0]
      fbAns.className = 'feedback-answer ja-text'
      if (fbAll) {
        fbAll.textContent = item.ja.length > 1 ? `別解: ${item.ja.slice(1).join(' / ')}` : ''
      }
    } else {
      fbAns.textContent = item.en
      fbAns.className = 'feedback-answer'
      if (fbAll) fbAll.textContent = ''
    }

    fb.classList.add('show')
  }

  const showMark = (correct: boolean) => {
    const container = document.getElementById('mark-container')
    if (!container) return

    if (correct) {
      container.innerHTML = `<svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
        <circle cx="28" cy="28" r="22" class="circle-path"/>
      </svg>`
    } else {
      container.innerHTML = `<svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
        <line x1="12" y1="12" x2="44" y2="44" class="cross-path1"/>
        <line x1="44" y1="12" x2="12" y2="44" class="cross-path2"/>
      </svg>`
    }
  }

  const nextQuestion = () => {
    if (state.currentIndex === state.queue.length - 1) {
      setScreen('result')
    } else {
      setState(prev => ({ ...prev, currentIndex: prev.currentIndex + 1 }))
    }
  }

  const showResult = () => {
    setScreen('result')
  }

  const retryMistakes = () => {
    const mistakes = state.results.filter(r => !r.correct)
    const newQueue = mistakes.map(r => r.item)
    setState(prev => ({
      ...prev,
      queue: newQueue,
      currentIndex: 0,
      results: [],
      isAnswered: false
    }))
    setScreen('quiz')
  }

  const retryAll = () => {
    const newQueue = [...state.queue].sort(() => Math.random() - 0.5)
    setState(prev => ({
      ...prev,
      queue: newQueue,
      currentIndex: 0,
      results: [],
      isAnswered: false
    }))
    setScreen('quiz')
  }

  const goToStart = () => {
    setScreen('start')
  }

  if (screen === 'quiz' && state.queue.length > 0) {
    const item = state.queue[state.currentIndex]
    
    return (
      <div className="note-page ring-holes">
        <div className="flex justify-between items-center mb-5">
          <div className="text-[13px] text-gray-500">
            {state.currentIndex + 1} / {state.queue.length}
          </div>
          <div className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue text-white">
            {state.mode === 'en2ja' ? '英→日' : '日→英'}
          </div>
        </div>

        <div className="w-full h-1.5 bg-border rounded mb-7 overflow-hidden">
          <div 
            className="h-full bg-red rounded transition-all"
            style={{ width: `${(state.currentIndex / state.queue.length) * 100}%` }}
          />
        </div>

        <div className="bg-bg border border-border rounded-xl p-6 mb-5">
          <div className="text-[11px] font-bold text-gray-400 tracking-wider mb-2">
            {state.mode === 'en2ja' ? '英語' : '日本語'}
          </div>
          <div className={`text-[20px] font-bold leading-relaxed ${state.mode === 'en2ja' ? 'font-mono' : ''}`}>
            {state.mode === 'en2ja' ? item.en : item.ja[0]}
          </div>
        </div>

        <div className="answer-area mb-4">
          <input
            id="answer-input"
            type="text"
            className="answer-input"
            placeholder={state.mode === 'en2ja' ? '日本語で答えてください…' : 'Type in English…'}
            onKeyDown={(e) => e.key === 'Enter' && !state.isAnswered && checkAnswer()}
            readOnly={state.isAnswered}
          />
        </div>

        <div id="feedback" className="feedback">
          <div className="feedback-correct-label">✏️ 正解</div>
          <div id="feedback-answer" className="feedback-answer"></div>
          <div id="feedback-all-answers" className="feedback-all-answers"></div>
        </div>

        <div className="mark-container" id="mark-container"></div>

        <div className="action-row flex gap-2.5">
          <button id="check-btn" className="check-btn" onClick={checkAnswer}>
            判定
          </button>
          <button id="next-btn" className="next-btn" onClick={nextQuestion}>
            次へ →
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'result') {
    const total = state.results.length
    const correct = state.results.filter(r => r.correct).length
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0
    const mistakes = state.results.filter(r => !r.correct)

    return (
      <div className="note-page ring-holes">
        <h2 className="result-title text-2xl font-bold mb-1.5">テスト結果</h2>
        <div className="result-score text-5xl font-bold text-red leading-none my-4">{pct}%</div>
        <div className="result-score-label text-sm text-gray-500 mb-3">{correct} / {total} 問正解</div>
        
        <div className="result-message bg-bg rounded-xl border-l-4 border-gold p-4 mb-6">
          {pct === 100 ? '完璧です！素晴らしい！' : pct >= 80 ? 'よくできました！' : pct >= 60 ? 'もう少し頑張りましょう' : '復習をおすすめします'}
        </div>

        {mistakes.length > 0 && (
          <div className="mistakes-section mb-6">
            <div className="mistakes-title text-[13px] font-bold text-red tracking-wider mb-3">
              ✏️ 間違えた問題 ({mistakes.length}問)
            </div>
            {mistakes.map((r, idx) => {
              const q = state.mode === 'en2ja' ? r.item.en : r.item.ja[0]
              const correctAns = state.mode === 'en2ja' ? r.item.ja[0] : r.item.en
              const isJaAns = state.mode === 'en2ja'
              return (
                <div key={idx} className="mistake-item p-3 bg-bg border-l-3 border-red rounded-r-lg mb-2 text-[13px]">
                  <div className="mistake-q text-gray-500 mb-1">{q}</div>
                  <div className="mistake-your text-red text-xs mb-1">あなたの答え: {r.userAnswer || '（未回答）'}</div>
                  <div className={`mistake-correct font-mono text-sm font-semibold ${isJaAns ? 'ja-text' : ''}`}>
                    正解: {correctAns}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="result-btns flex flex-col gap-2.5">
          <button 
            className="result-btn primary"
            onClick={retryMistakes}
            style={{ display: mistakes.length > 0 ? 'block' : 'none' }}
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
    )
  }

  return (
    <div className="note-page ring-holes">
      <h1 className="app-title text-[22px] font-bold mb-1">📖 英語練習テスト</h1>
      <p className="app-subtitle text-[13px] text-gray-500 mb-7">EIGO NO PARTNER</p>

      <div className="section-label text-[12px] font-bold text-red uppercase tracking-wider mb-2.5">モードを選ぶ</div>
      <div className="mode-buttons grid grid-cols-2 gap-2.5 mb-1.5">
        <button 
          className={`mode-btn ${state.mode === 'en2ja' ? 'selected' : ''}`}
          onClick={() => selectMode('en2ja')}
        >
          <span className="mode-icon text-[22px] block mb-1">🇬🇧→🇯🇵</span>
          英→日
        </button>
        <button 
          className={`mode-btn ${state.mode === 'ja2en' ? 'selected' : ''}`}
          onClick={() => selectMode('ja2en')}
        >
          <span className="mode-icon text-[22px] block mb-1">🇯🇵→🇬🇧</span>
          日→英
        </button>
      </div>

      <div className="section-label text-[12px] font-bold text-red uppercase tracking-wider mb-2.5 mt-5">レッスンを選ぶ</div>
      <div className="lesson-grid flex flex-wrap gap-2 mb-1">
        {state.lessons.map(lesson => (
          <button
            key={lesson}
            className={`lesson-btn ${state.selectedLesson === lesson ? 'selected' : ''}`}
            onClick={() => selectLesson(lesson)}
          >
            {lesson === 'Starter' ? 'Starter' : `Lesson ${lesson}`}
          </button>
        ))}
      </div>

      {state.selectedLesson && state.parts.length > 0 && (
        <div id="part-section" className="mt-5">
          <div className="section-label text-[12px] font-bold text-red uppercase tracking-wider mb-2.5">パートを選ぶ</div>
          <div className="part-row flex flex-wrap gap-2">
            <button
              className={`part-btn ${state.selectedPart === 'all' ? 'selected' : ''}`}
              onClick={() => selectPart('all')}
            >
              すべて
            </button>
            {state.parts.map(part => (
              <button
                key={part}
                className={`part-btn ${state.selectedPart === part ? 'selected' : ''}`}
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

      <div id="kuromoji-loading" className="text-center text-xs text-gray-400 mb-2">
        {state.kuromojiReady ? '✓ 準備完了' : '⏳ 辞書を読み込み中…'}
      </div>

      <button 
        id="start-btn"
        className="start-btn"
        disabled={state.selectedLesson === null || !state.kuromojiReady}
        onClick={() => {
          const shuffle = (document.getElementById('shuffle-check') as HTMLInputElement).checked
          startQuiz(shuffle)
        }}
      >
        開始
      </button>
    </div>
  )
}