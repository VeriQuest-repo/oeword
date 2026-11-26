// 단어와 품사별 뜻의 주고받는 모양, 입력 검사 (#5). 화면과 서버가 함께 씁니다.
//
// 한 단어에 품사 여러 개, 품사마다 뜻 여러 개를 둡니다.
// 예: present → [명사] 선물, 현재 / [형용사] 출석한, 현재의
// 뜻은 단어장에 적힌 그대로 저장합니다 (채점 기준, CLAUDE.md 5장). 앞뒤·여러 칸 공백만 정리하고,
// 쉼표·세미콜론은 뜻을 나누는 표시로 봅니다 (괄호 안 제외, #34).
import { tidy } from "./books";

export const WORD_MAX_LENGTH = 60;
export const POS_MAX_LENGTH = 10;
export const MEANING_MAX_LENGTH = 60;
export const SENSE_MAX_COUNT = 10;
export const MEANING_PER_SENSE_MAX_COUNT = 10;

/** 고르기 쉬운 품사 목록. 이 밖의 품사도 직접 적을 수 있습니다. */
export const POS_OPTIONS = ["명사", "동사", "형용사", "부사", "전치사", "접속사", "대명사", "감탄사", "숙어"] as const;

/** 품사 하나와 그 품사의 뜻들 */
export interface Sense {
  pos: string;
  meanings: string[];
}

export interface WordInput {
  text: string;
  senses: Sense[];
}

/** 화면에 보여 줄 단어 */
export interface WordView extends WordInput {
  id: number;
}

/** GET /api/days/:dayId/words 응답 */
export interface DayWords {
  day: { id: number; bookId: number; bookTitle: string; dayNumber: number; title: string | null };
  words: WordView[];
}

const POS_ALIASES: Record<string, string> = {
  n: "명사",
  noun: "명사",
  명: "명사",
  v: "동사",
  vt: "동사",
  vi: "동사",
  verb: "동사",
  동: "동사",
  a: "형용사",
  adj: "형용사",
  형: "형용사",
  ad: "부사",
  adv: "부사",
  부: "부사",
  prep: "전치사",
  전: "전치사",
  conj: "접속사",
  접: "접속사",
  pron: "대명사",
  대: "대명사",
  int: "감탄사",
  interj: "감탄사",
  감: "감탄사",
  phr: "숙어",
  idiom: "숙어",
};

/**
 * 품사 이름을 맞춥니다. 대괄호·마침표를 떼고, 흔한 줄임말(n., v., adj., 명, 동 …)은 한국어 이름으로 바꿉니다.
 * 예: "[명]" → "명사", "adj." → "형용사", "숙어" → "숙어"
 */
export function normalizePos(value: string): string {
  const bare = tidy(value)
    .replace(/^[[(（【<]+|[\])）】>]+$/g, "")
    .replace(/\.+$/, "")
    .trim();
  return POS_ALIASES[bare.toLowerCase()] ?? bare;
}

/** 뜻 칸을 쉼표·세미콜론으로 나눕니다. 괄호 안의 쉼표는 나누지 않습니다. */
export function splitMeanings(cell: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of cell) {
    if ("([{（［".includes(ch)) depth++;
    if (")]}）］".includes(ch)) depth = Math.max(0, depth - 1);
    if (depth === 0 && ",;，；".includes(ch)) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((p) => tidy(p)).filter(Boolean);
}

/** 뜻 정리: 앞뒤·여러 칸 공백만 정리합니다 (괄호·물결은 그대로). */
export function tidyMeaning(value: string): string {
  return tidy(value);
}

type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

/**
 * 단어 입력을 검사하고 정리합니다.
 * - 뜻 칸의 쉼표·세미콜론은 뜻을 나누는 표시입니다 (괄호 안 제외).
 * - 빈 뜻 칸은 건너뜁니다. 같은 품사가 두 번 나오면 하나로 합치고, 같은 뜻은 한 번만 남깁니다.
 * - 품사마다 뜻이 하나 이상 있어야 합니다.
 */
export function checkWordInput(body: unknown): Checked<WordInput> {
  if (typeof body !== "object" || body === null) return { ok: false, message: "입력 내용을 읽지 못했어요." };
  const { text, senses } = body as Record<string, unknown>;
  if (typeof text !== "string" || !Array.isArray(senses)) return { ok: false, message: "입력 내용을 읽지 못했어요." };

  const word = tidy(text);
  if (!word) return { ok: false, message: "단어를 적어 주세요." };
  if (word.length > WORD_MAX_LENGTH) return { ok: false, message: `단어는 ${WORD_MAX_LENGTH}자까지 쓸 수 있어요.` };

  const merged: Sense[] = [];
  for (const raw of senses) {
    if (typeof raw !== "object" || raw === null) return { ok: false, message: "뜻을 읽지 못했어요." };
    const { pos: rawPos, meanings: rawMeanings } = raw as Record<string, unknown>;
    if (typeof rawPos !== "string" || !Array.isArray(rawMeanings)) return { ok: false, message: "뜻을 읽지 못했어요." };
    if (rawMeanings.some((m) => typeof m !== "string")) return { ok: false, message: "뜻을 읽지 못했어요." };

    // 한 칸에 쉼표로 적은 뜻도 붙여넣기와 같은 규칙으로 나눕니다 (#34). 예: "선물, 현재" → 뜻 2개
    const meanings = (rawMeanings as string[]).flatMap(splitMeanings).map(tidyMeaning).filter(Boolean);
    const pos = normalizePos(rawPos);
    if (!pos && meanings.length === 0) continue; // 통째로 빈 품사 칸
    if (!pos) return { ok: false, message: `"${word}"의 품사를 골라 주세요.` };
    if (pos.length > POS_MAX_LENGTH) return { ok: false, message: `품사는 ${POS_MAX_LENGTH}자까지 쓸 수 있어요.` };
    if (meanings.length === 0) return { ok: false, message: `"${word}" [${pos}]의 뜻을 적어 주세요.` };
    const tooLong = meanings.find((m) => m.length > MEANING_MAX_LENGTH);
    if (tooLong) return { ok: false, message: `뜻은 ${MEANING_MAX_LENGTH}자까지 쓸 수 있어요: "${tooLong.slice(0, 20)}…"` };

    const same = merged.find((s) => s.pos === pos);
    const target = same ?? { pos, meanings: [] };
    for (const m of meanings) if (!target.meanings.includes(m)) target.meanings.push(m);
    if (!same) merged.push(target);
  }

  if (merged.length === 0) return { ok: false, message: `"${word}"의 품사와 뜻을 적어 주세요.` };
  if (merged.length > SENSE_MAX_COUNT) return { ok: false, message: `품사는 ${SENSE_MAX_COUNT}개까지 넣을 수 있어요.` };
  if (merged.some((s) => s.meanings.length > MEANING_PER_SENSE_MAX_COUNT)) {
    return { ok: false, message: `한 품사에 뜻은 ${MEANING_PER_SENSE_MAX_COUNT}개까지 넣을 수 있어요.` };
  }
  return { ok: true, value: { text: word, senses: merged } };
}

/** 저장용으로 펼치기: 품사 순서 → 뜻 순서대로 한 줄씩 */
export function flattenSenses(senses: Sense[]): { pos: string; text: string }[] {
  return senses.flatMap((s) => s.meanings.map((text) => ({ pos: s.pos, text })));
}

/** 저장된 뜻(순서대로)을 품사별로 묶기. 처음 나온 품사 순서를 지킵니다. */
export function groupMeanings(meanings: { pos: string; text: string }[]): Sense[] {
  const senses: Sense[] = [];
  for (const m of meanings) {
    const sense = senses.find((s) => s.pos === m.pos);
    if (sense) sense.meanings.push(m.text);
    else senses.push({ pos: m.pos, meanings: [m.text] });
  }
  return senses;
}

/** 한 줄로 보여 주기. 예: "[명사] 선물, 현재 / [형용사] 출석한, 현재의" */
export function sensesText(senses: Sense[]): string {
  return senses.map((s) => `[${s.pos}] ${s.meanings.join(", ")}`).join(" / ");
}
