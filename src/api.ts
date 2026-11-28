// 화면에서 /api/* 를 부르는 함수 (화면 전용, 서버에서는 쓰지 않음). 로그인·구성원 선택 (#3).
import type { BookDetail, BookSummary, DaySummary } from "./lib/books";
import type { SessionResponse, SetupInput } from "./lib/session";
import type { CompletionInput, StudyRecords } from "./lib/study";
import type { TestDetail, TestSubmitInput } from "./lib/test";
import type { DayWords, WordInput, WordView } from "./lib/words";

/** 서버가 돌려준 한국어 문구를 담은 오류. 화면에 그대로 보여 줍니다. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, method: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError("서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.", 0);
  }
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const message =
      typeof data === "object" && data !== null && typeof (data as { message?: unknown }).message === "string"
        ? (data as { message: string }).message
        : "잠시 문제가 생겼어요. 다시 해 주세요.";
    throw new ApiRequestError(message, res.status);
  }
  return data as T;
}

export const api = {
  session: () => request<SessionResponse>("/api/session", "GET"),
  setup: (input: SetupInput) => request<SessionResponse>("/api/setup", "POST", input),
  login: (password: string) => request<SessionResponse>("/api/login", "POST", { password }),
  logout: () => request<SessionResponse>("/api/logout", "POST", {}),
  chooseMember: (memberId: number | null) =>
    request<SessionResponse>("/api/session/member", "PUT", { memberId }),

  // 단어장·Day (#4)
  books: (includeArchived = false) =>
    request<{ books: BookSummary[] }>(`/api/books${includeArchived ? "?archived=1" : ""}`, "GET"),
  createBook: (title: string) => request<BookDetail>("/api/books", "POST", { title }),
  book: (bookId: number) => request<BookDetail>(`/api/books/${bookId}`, "GET"),
  updateBook: (bookId: number, change: { title?: string; archived?: boolean }) =>
    request<BookDetail>(`/api/books/${bookId}`, "PATCH", change),
  createDay: (bookId: number, input: { dayNumber?: string; title?: string }) =>
    request<BookDetail & { day: DaySummary }>(`/api/books/${bookId}/days`, "POST", input),
  updateDay: (dayId: number, change: { dayNumber?: string; title?: string }) =>
    request<BookDetail>(`/api/days/${dayId}`, "PATCH", change),
  moveDay: (dayId: number, direction: "up" | "down") =>
    request<BookDetail>(`/api/days/${dayId}/move`, "POST", { direction }),
  deleteDay: (dayId: number) => request<BookDetail>(`/api/days/${dayId}`, "DELETE"),

  // 단어 (#5)
  dayWords: (dayId: number) => request<DayWords>(`/api/days/${dayId}/words`, "GET"),
  addWord: (dayId: number, input: WordInput) =>
    request<{ word: WordView; merged?: true }>(`/api/days/${dayId}/words`, "POST", input),
  updateWord: (wordId: number, input: WordInput) => request<{ word: WordView }>(`/api/words/${wordId}`, "PUT", input),
  addWords: (dayId: number, words: WordInput[]) =>
    request<DayWords>(`/api/days/${dayId}/words/bulk`, "POST", { words }),
  deleteWord: (wordId: number) => request<{ ok: true }>(`/api/words/${wordId}`, "DELETE"),

  // 외우기 완료 기록 (#44)
  saveCompletion: (input: CompletionInput) => request<{ id: number }>("/api/study/completions", "POST", input),
  studyRecords: (bookId: number, studentId: number) =>
    request<StudyRecords>(`/api/books/${bookId}/study-records?studentId=${studentId}`, "GET"),

  // 화면 시험 (#10)
  submitTest: (input: TestSubmitInput) => request<TestDetail>("/api/tests", "POST", input),
};

/** 오류를 화면에 보여 줄 문구로 바꿉니다. */
export function errorMessage(e: unknown): string {
  return e instanceof ApiRequestError ? e.message : "잠시 문제가 생겼어요. 다시 해 주세요.";
}
