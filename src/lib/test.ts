// 화면 시험 (#10) 의 주고받는 모양, 입력 검사, 문항 채점. 화면과 서버가 함께 씁니다.
//
// 학생 답(test_item.answer) 저장 형식 (#10 에서 정함)
// - 영→한(en_ko): 품사 → 쓴 답 JSON 객체. 예: {"명사":"선물","형용사":"출석한"} (빈 칸은 "")
// - 한→영(ko_en): 쓴 영단어 그대로. 예: "present"
// 품사 이름으로 저장하므로 나중에 단어장의 품사 순서가 바뀌어도 답이 엉키지 않습니다.
import { gradeEnKo, gradeKoEn, type SenseGrade } from "./grading";
import type { StudyCard, StudyDirection } from "./study";
import type { Sense } from "./words";

export type TestMode = "smart" | "full" | "review";
export type TestDirection = StudyDirection;
export type ItemDirection = "en_ko" | "ko_en";

/** 영→한은 품사별 답, 한→영은 영단어 하나 */
export type ItemAnswer = Record<string, string> | string;

export const TEST_MAX_ITEMS = 300;
export const ANSWER_MAX_LENGTH = 200;

export const MODE_LABELS: Record<TestMode, string> = {
  smart: "스마트",
  full: "전체",
  review: "다시 보기",
};

export const DIRECTION_LABELS: Record<TestDirection, string> = {
  en_ko: "영→한",
  ko_en: "한→영",
  mixed: "섞기",
};

/** 시험 한 문항 (화면이 들고 있는 모양) */
export interface TestQuestion extends StudyCard {
  direction: ItemDirection;
}

/** POST /api/tests 요청: 다 푼 시험을 한꺼번에 보내 채점합니다. */
export interface TestSubmitInput {
  mode: "full" | "review";
  direction: TestDirection;
  firstLetterHint: boolean;
  dayIds: number[];
  /** 시험을 시작한 시각 (걸린 시간 계산용) */
  startedAt: string;
  items: { wordId: number; direction: ItemDirection; answer: ItemAnswer }[];
}

/** 채점한 문항 하나 */
export interface TestItemResult {
  position: number;
  wordId: number;
  text: string;
  direction: ItemDirection;
  senses: Sense[];
  days: string[];
  answer: ItemAnswer;
  correct: boolean;
  /** 영→한 품사별 채점 (결과 화면에서 품사마다 맞음·틀림을 보여 줌) */
  senseGrades: SenseGrade[] | null;
}

/** 채점한 시험 (POST /api/tests, GET /api/tests/:id 응답) */
export interface TestDetail {
  /** 저장하지 않은 시험(보호자가 본 시험)은 null */
  id: number | null;
  testNumber: number | null;
  studentId: number | null;
  mode: TestMode;
  direction: TestDirection;
  firstLetterHint: boolean;
  createdAt: string;
  finishedAt: string | null;
  dayIds: number[];
  dayLabels: string[];
  correctCount: number;
  total: number;
  items: TestItemResult[];
}

/** 문항 하나를 채점합니다. card 는 시험 범위에서 합친 단어(여러 Day 의 같은 단어는 뜻을 합침)입니다. */
export function gradeItem(
  card: Pick<StudyCard, "text" | "senses">,
  direction: ItemDirection,
  answer: ItemAnswer,
): { correct: boolean; senseGrades: SenseGrade[] | null } {
  if (direction === "ko_en") {
    return { correct: gradeKoEn(card.text, typeof answer === "string" ? answer : ""), senseGrades: null };
  }
  const byPos = typeof answer === "string" ? {} : answer;
  const grade = gradeEnKo(card.senses, card.senses.map((s) => byPos[s.pos] ?? ""));
  return { correct: grade.correct, senseGrades: grade.senses };
}

/** 저장용 글자로 바꿉니다 (위 '학생 답 저장 형식'). */
export function encodeAnswer(direction: ItemDirection, answer: ItemAnswer): string {
  if (direction === "ko_en") return typeof answer === "string" ? answer : "";
  return JSON.stringify(typeof answer === "string" ? {} : answer);
}

/** 저장된 글자를 다시 답으로 읽습니다. 읽지 못하면 빈 답입니다. */
export function decodeAnswer(direction: ItemDirection, stored: string | null): ItemAnswer {
  if (direction === "ko_en") return stored ?? "";
  if (!stored) return {};
  try {
    const value = JSON.parse(stored) as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  } catch {
    return {};
  }
}

/** 빈 답인지 (모든 칸이 비었는지) */
export function isBlank(answer: ItemAnswer | undefined): boolean {
  if (answer === undefined) return true;
  if (typeof answer === "string") return answer.trim() === "";
  return Object.values(answer).every((v) => v.trim() === "");
}

/** 첫 알파벳 힌트: 영단어의 첫 글자 (괄호·물결 같은 기호는 건너뜀). 예: "(be) able" → "b" */
export function firstLetter(word: string): string {
  return /[A-Za-z]/.exec(word)?.[0]?.toLowerCase() ?? word.trim().charAt(0);
}

/** 걸린 시간. 예: "12분 30초", "45초". 1초 미만·알 수 없으면 null */
export function durationLabel(startedAt: string, finishedAt: string | null): string | null {
  if (!finishedAt) return null;
  const seconds = Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1000);
  if (!Number.isFinite(seconds) || seconds < 1) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

const DIRECTIONS: readonly string[] = ["en_ko", "ko_en", "mixed"];

function checkAnswer(direction: ItemDirection, raw: unknown): ItemAnswer | null {
  if (direction === "ko_en") {
    if (typeof raw !== "string" || raw.length > ANSWER_MAX_LENGTH) return null;
    return raw;
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const entries = Object.entries(raw);
  if (entries.length > 20) return null;
  if (!entries.every(([pos, v]) => pos.length <= 20 && typeof v === "string" && v.length <= ANSWER_MAX_LENGTH)) {
    return null;
  }
  return Object.fromEntries(entries) as Record<string, string>;
}

/** POST /api/tests 요청을 검사합니다. startedAt 이 이상하면(미래·하루 넘게 전) 지금 시각으로 바꿉니다. */
export function checkSubmitInput(body: unknown, now: Date): Checked<TestSubmitInput> {
  if (typeof body !== "object" || body === null) return { ok: false, message: "시험 답을 읽지 못했어요." };
  const { mode, direction, firstLetterHint, dayIds, startedAt, items } = body as Record<string, unknown>;
  if (mode !== "full" && mode !== "review") return { ok: false, message: "시험 방식을 알 수 없어요." };
  if (typeof direction !== "string" || !DIRECTIONS.includes(direction)) {
    return { ok: false, message: "시험 형식을 알 수 없어요." };
  }
  if (
    !Array.isArray(dayIds) ||
    dayIds.length === 0 ||
    dayIds.length > 100 ||
    !dayIds.every((id) => Number.isSafeInteger(id) && id > 0)
  ) {
    return { ok: false, message: "Day를 알 수 없어요." };
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > TEST_MAX_ITEMS) {
    return { ok: false, message: "시험 문제를 읽지 못했어요." };
  }
  const seen = new Set<number>();
  const checked: TestSubmitInput["items"] = [];
  for (const raw of items as unknown[]) {
    if (typeof raw !== "object" || raw === null) return { ok: false, message: "시험 문제를 읽지 못했어요." };
    const item = raw as Record<string, unknown>;
    const wordId = item.wordId;
    const itemDirection = item.direction;
    if (!Number.isSafeInteger(wordId) || (wordId as number) < 1 || seen.has(wordId as number)) {
      return { ok: false, message: "시험 문제를 읽지 못했어요." };
    }
    if (itemDirection !== "en_ko" && itemDirection !== "ko_en") return { ok: false, message: "시험 문제를 읽지 못했어요." };
    if (direction !== "mixed" && itemDirection !== direction) return { ok: false, message: "시험 형식이 맞지 않아요." };
    const answer = checkAnswer(itemDirection, item.answer);
    if (answer === null) return { ok: false, message: "답이 너무 길어요." };
    seen.add(wordId as number);
    checked.push({ wordId: wordId as number, direction: itemDirection, answer });
  }
  const started = typeof startedAt === "string" ? Date.parse(startedAt) : Number.NaN;
  const valid = Number.isFinite(started) && started <= now.getTime() && now.getTime() - started <= 24 * 3600 * 1000;
  return {
    ok: true,
    value: {
      mode,
      direction: direction as TestDirection,
      firstLetterHint: firstLetterHint === true,
      dayIds: [...new Set(dayIds as number[])],
      startedAt: isoSeconds(valid ? new Date(started) : now),
      items: checked,
    },
  };
}

/** D1 에 저장하는 시각 모양 (초까지, Z). 예: 2026-11-28T12:00:00Z */
export function isoSeconds(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}
