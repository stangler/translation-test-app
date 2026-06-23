#!/usr/bin/env python3
"""
xlsx → words-data.json 変換スクリプト
列構成: Lesson / Part / 英語 / 日本語
"""

import json
import re
import sys
from pathlib import Path
import openpyxl


def parse_ja_answer(ja_text: str) -> list[str]:
    """
    日本語テキストから正解候補リストを生成する。
    例: 「私はネコを好みます。（=私はネコが好きです。）」
    → ["私はネコを好みます。", "私はネコが好きです。"]
    """
    if not ja_text:
        return []

    answers = []
    main = re.sub(r'（[^）]*）', '', ja_text).strip()
    if main:
        answers.append(main)

    for m in re.finditer(r'（=([^）]+)）', ja_text):
        alt = m.group(1).strip()
        if alt and alt not in answers:
            answers.append(alt)

    return answers if answers else [ja_text]


# ことができます直前の動詞 → 可能形語幹
POTENTIAL_MAP = {
    # ひらがな
    'かく': 'かけ', 'ひく': 'ひけ', 'およぐ': 'およげ',
    'はしる': 'はしれ', 'のむ': 'のめ', 'よむ': 'よめ',
    'おどる': 'おどれ', 'うたう': 'うたえ', 'つくる': 'つくれ',
    'のる': 'のれ', 'いく': 'いけ', 'ふく': 'ふけ', 'さす': 'させ',
    'はなす': 'はなせ', 'まつ': 'まて', 'かう': 'かえ',
    'あそぶ': 'あそべ', 'とぶ': 'とべ', 'のぼる': 'のぼれ',
    'とる': 'とれ', 'つかう': 'つかえ',
    # 漢字
    '読む': '読め', '書く': '書け', '走る': '走れ',
    '泳ぐ': '泳げ', '踊る': '踊れ', '歌う': '歌え',
    '飲む': '飲め', '乗る': '乗れ', '行く': '行け',
    '吹く': '吹け', '作る': '作れ', '使う': '使え',
    '話す': '話せ', '待つ': '待て', '買う': '買え',
    '弾く': '弾け', '描く': '描け',
}

VERB_PATTERN = re.compile(
    r'^(.*?)(' + '|'.join(re.escape(k) for k in sorted(POTENTIAL_MAP.keys(), key=len, reverse=True)) + r')ことができ(ます|ません|ますか)。$'
)

# 一人称代名詞の対応表
PRONOUN_ALTS = [
    (['私は', '私が'], ['ぼくは', '僕は', 'ぼくが', '僕が']),
    (['ぼくは', '僕は'], ['私は', 'ぼくが', '僕が', '私が']),
]


def expand_pronoun(ans: str) -> list[str]:
    extras = []
    for originals, alts in PRONOUN_ALTS:
        for orig in originals:
            if ans.startswith(orig):
                rest = ans[len(orig):]
                for alt in alts:
                    candidate = alt + rest
                    if candidate not in extras and candidate != ans:
                        extras.append(candidate)
    return extras


def expand_answers(answers: list[str]) -> list[str]:
    """別解を自動展開する"""
    result = list(answers)

    for ans in list(result):
        # 一人称代名詞展開
        for extra in expand_pronoun(ans):
            if extra not in result:
                result.append(extra)

        sfx = None
        if ans.endswith('ことができます。'):
            sfx = 'ます'
        elif ans.endswith('ことができません。'):
            sfx = 'ません'
        elif ans.endswith('ことができますか。'):
            sfx = 'ますか'

        if sfx:
            # をすること → をができ
            m2 = re.match(r'^(.*を)することができ(ます|ません|ますか)。$', ans)
            if m2:
                alt = m2.group(1)[:-1] + 'ができ' + m2.group(2) + '。'
                if alt not in result:
                    result.append(alt)

            # 演奏/料理する系
            m3 = re.match(r'^(.*(?:演奏|料理|えんそう|りょうり))することができ(ます|ません|ますか)。$', ans)
            if m3:
                alt = m3.group(1) + 'でき' + m3.group(2) + '。'
                if alt not in result:
                    result.append(alt)

            # ひらがな/漢字動詞→可能形
            m4 = VERB_PATTERN.match(ans)
            if m4:
                prefix, verb, s = m4.group(1), m4.group(2), m4.group(3)
                pot = POTENTIAL_MAP.get(verb)
                if pot:
                    alt = prefix + pot + s + '。'
                    if alt not in result:
                        result.append(alt)

        # みます↔見ます
        for src, dst in [('をみます。', 'を見ます。'), ('をみますか。', 'を見ますか。')]:
            if src in ans:
                alt = ans.replace(src, dst)
                if alt not in result:
                    result.append(alt)

    return result


def build(xlsx_path: Path, out_path: Path):
    wb = openpyxl.load_workbook(xlsx_path, read_only=True)
    ws = wb.active

    rows = list(ws.iter_rows(values_only=True))

    data = []
    for row in rows[1:]:
        if not any(row):
            continue
        lesson_raw, part_raw, en, ja = row[0], row[1], row[2], row[3]

        if not en or not ja:
            continue

        lesson = str(lesson_raw).strip() if lesson_raw is not None else ""
        part = str(part_raw).strip() if part_raw is not None and str(part_raw).strip() != "" else ""
        try:
            part = str(int(float(part))) if part else ""
        except (ValueError, TypeError):
            pass

        ja_str = str(ja).strip()
        en_str = str(en).strip()

        ja_answers = parse_ja_answer(ja_str)
        ja_answers = expand_answers(ja_answers)

        data.append({
            "lesson": lesson,
            "part": part,
            "en": en_str,
            "ja": ja_str,
            "ja_answers": ja_answers,
        })

    wb.close()

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"✓ {len(data)} 件出力 → {out_path}")


if __name__ == "__main__":
    args = sys.argv[1:]
    xlsx_args = [a for a in args if not a.startswith("--")]

    xlsx = Path(xlsx_args[0]) if xlsx_args else Path("data.xlsx")
    out = Path("public/words-data.json")

    build(xlsx, out)
