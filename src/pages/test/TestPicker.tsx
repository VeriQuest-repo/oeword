import { useEffect, useState } from "react";
import { api, errorMessage } from "../../api";
import { ChoiceButton, ErrorText, Panel, PrimaryButton } from "../../components/ui";
import { type BookDetail, type BookSummary, dayLabel } from "../../lib/books";
import type { MemberSummary } from "../../lib/session";
import { assignDirections, buildDeck, shuffle } from "../../lib/study";
import { DIRECTION_LABELS, type TestDirection } from "../../lib/test";
import type { TestPlan } from "./draft";

const directions: { value: TestDirection; hint: string }[] = [
  { value: "en_ko", hint: "영단어 보고 뜻 쓰기" },
  { value: "ko_en", hint: "뜻 보고 영단어 쓰기" },
  { value: "mixed", hint: "반반 섞어서" },
];

// 새 시험 고르기 (#10): 단어장 → Day 여러 개 → 형식(영→한·한→영·섞기) → 첫 알파벳 힌트
export default function TestPicker({ member, onStart }: { member: MemberSummary; onStart: (plan: TestPlan) => void }) {
  const [books, setBooks] = useState<BookSummary[] | null>(null);
  const [bookId, setBookId] = useState<number | null>(null);
  const [detail, setDetail] = useState<BookDetail | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [direction, setDirection] = useState<TestDirection>("en_ko");
  const [hint, setHint] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .books()
      .then(({ books: list }) => {
        setBooks(list);
        if (list.length === 1) setBookId(list[0]!.id);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(() => {
    if (bookId === null) return;
    api
      .book(bookId)
      .then(setDetail)
      .catch((e) => setError(errorMessage(e)));
  }, [bookId]);

  const days = detail?.days ?? [];
  const pickedDays = days.filter((d) => picked.includes(d.id));
  const wordCount = pickedDays.reduce((sum, d) => sum + d.wordCount, 0);

  function chooseBook(id: number) {
    if (id === bookId) return;
    setDetail(null);
    setPicked([]);
    setBookId(id);
  }

  function toggle(dayId: number) {
    setPicked((list) => (list.includes(dayId) ? list.filter((id) => id !== dayId) : [...list, dayId]));
  }

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const list = await Promise.all(pickedDays.map((d) => api.dayWords(d.id)));
      const deck = buildDeck(list);
      if (deck.length === 0) {
        setError("고른 Day에 단어가 없어요.");
        return;
      }
      onStart({
        mode: "full",
        direction,
        firstLetterHint: direction !== "en_ko" && hint,
        dayIds: pickedDays.map((d) => d.id),
        // 시험은 늘 순서를 섞어 냅니다.
        questions: assignDirections(shuffle(deck), direction),
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">새 시험</h2>
        <p className="mt-1 text-base text-slate-500">
          범위의 모든 단어가 순서를 섞어 나와요. 다 푼 뒤 한꺼번에 채점해요.
          {member.role !== "student" && " 보호자가 본 시험은 채점만 하고 기록에 남지 않아요."}
        </p>
      </div>

      <ErrorText message={error} />

      {books === null ? (
        !error && <p className="text-base text-slate-400">불러오는 중…</p>
      ) : books.length === 0 ? (
        <Panel>
          <p className="text-base text-slate-600">아직 단어장이 없어요. 단어장을 먼저 만들어 주세요.</p>
        </Panel>
      ) : (
        <>
          {books.length > 1 && (
            <Panel>
              <h3 className="mb-3 text-lg font-semibold text-slate-800">단어장</h3>
              <div className="flex flex-wrap gap-2">
                {books.map((b) => (
                  <ChoiceButton key={b.id} selected={b.id === bookId} onClick={() => chooseBook(b.id)}>
                    {b.title}
                  </ChoiceButton>
                ))}
              </div>
            </Panel>
          )}

          {bookId !== null && (
            <Panel>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold text-slate-800">시험 범위</h3>
                {days.length > 0 && <p className="text-base text-slate-500">Day를 여러 개 고를 수 있어요</p>}
              </div>
              {!detail ? (
                <p className="text-base text-slate-400">불러오는 중…</p>
              ) : days.length === 0 ? (
                <p className="text-base text-slate-600">이 단어장에는 아직 Day가 없어요.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {days.map((d) => (
                    <ChoiceButton
                      key={d.id}
                      selected={picked.includes(d.id)}
                      disabled={d.wordCount === 0}
                      onClick={() => toggle(d.id)}
                    >
                      <span className="block break-words">{dayLabel(d)}</span>
                      <span className="block text-sm font-normal opacity-80">{d.wordCount}단어</span>
                    </ChoiceButton>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {bookId !== null && days.length > 0 && (
            <Panel>
              <h3 className="mb-3 text-lg font-semibold text-slate-800">형식</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {directions.map((d) => (
                  <ChoiceButton key={d.value} selected={direction === d.value} onClick={() => setDirection(d.value)}>
                    <span className="block break-words">{DIRECTION_LABELS[d.value]}</span>
                    <span className="block text-sm font-normal opacity-80">{d.hint}</span>
                  </ChoiceButton>
                ))}
              </div>
              {direction !== "en_ko" && (
                <label className="mt-4 flex min-h-12 items-center gap-3 text-base text-slate-700">
                  <input
                    type="checkbox"
                    checked={hint}
                    onChange={(e) => setHint(e.target.checked)}
                    className="size-6 shrink-0 accent-indigo-600"
                  />
                  한→영 문제에 첫 알파벳 보여 주기
                </label>
              )}
            </Panel>
          )}

          {bookId !== null && days.length > 0 && (
            <div className="flex justify-end">
              <PrimaryButton
                type="button"
                disabled={picked.length === 0 || loading}
                onClick={start}
                className="w-full sm:w-auto"
              >
                {loading ? "준비하는 중…" : picked.length === 0 ? "Day를 골라 주세요" : `시험 시작 (${wordCount}단어)`}
              </PrimaryButton>
            </div>
          )}
        </>
      )}
    </div>
  );
}
