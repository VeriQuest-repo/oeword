// 단어장·Day API 의 주고받는 모양과 입력 검사 (#4). 화면과 서버가 함께 씁니다.

export const BOOK_TITLE_MAX_LENGTH = 40;
export const DAY_TITLE_MAX_LENGTH = 40;
export const DAY_NUMBER_MAX = 999;

export interface BookSummary {
  id: number;
  title: string;
  archived: boolean;
  dayCount: number;
  wordCount: number;
}

export interface DaySummary {
  id: number;
  dayNumber: number;
  title: string | null;
  wordCount: number;
}

/** GET /api/books/:id 응답 */
export interface BookDetail {
  book: BookSummary;
  days: DaySummary[];
}

type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

/** 앞뒤 공백을 빼고, 중간의 여러 칸 공백은 한 칸으로 줄입니다. */
export function tidy(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function checkBookTitle(value: unknown): Checked<string> {
  if (typeof value !== "string") return { ok: false, message: "단어장 이름을 적어 주세요." };
  const title = tidy(value);
  if (!title) return { ok: false, message: "단어장 이름을 적어 주세요." };
  if (title.length > BOOK_TITLE_MAX_LENGTH) {
    return { ok: false, message: `단어장 이름은 ${BOOK_TITLE_MAX_LENGTH}자까지 쓸 수 있어요.` };
  }
  return { ok: true, value: title };
}

/** Day 번호: 1 이상 999 이하의 정수. 화면 입력(문자열)도 받습니다. */
export function checkDayNumber(value: unknown): Checked<number> {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > DAY_NUMBER_MAX) {
    return { ok: false, message: `Day 번호는 1부터 ${DAY_NUMBER_MAX} 사이의 숫자로 적어 주세요.` };
  }
  return { ok: true, value: n };
}

/** Day 제목은 비워 둘 수 있습니다 (빈칸이면 null). */
export function checkDayTitle(value: unknown): Checked<string | null> {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, message: "Day 제목을 읽지 못했어요." };
  const title = tidy(value);
  if (title.length > DAY_TITLE_MAX_LENGTH) {
    return { ok: false, message: `Day 제목은 ${DAY_TITLE_MAX_LENGTH}자까지 쓸 수 있어요.` };
  }
  return { ok: true, value: title || null };
}

/** 화면에 보여 줄 Day 이름. 예: "Day 3 · 동물" */
export function dayLabel(day: { dayNumber: number; title: string | null }): string {
  return day.title ? `Day ${day.dayNumber} · ${day.title}` : `Day ${day.dayNumber}`;
}
