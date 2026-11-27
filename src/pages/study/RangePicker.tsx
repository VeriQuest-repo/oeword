import { type ButtonHTMLAttributes, type ReactNode, useEffect, useState } from "react";
import { api, errorMessage } from "../../api";
import { ErrorText, Panel, PrimaryButton } from "../../components/ui";
import { type BookDetail, type BookSummary, dayLabel } from "../../lib/books";
import { assignDirections, buildDeck, shuffle, type StudyDirection, type StudyItem } from "../../lib/study";

const directions: { value: StudyDirection; label: string; hint: string }[] = [
  { value: "en_ko", label: "영단어", hint: "영단어 보고 뜻 쓰기" },
  { value: "ko_en", label: "뜻", hint: "뜻 보고 영단어 쓰기" },
  { value: "mixed", label: "영단어/뜻", hint: "반반 섞어서" },
];

// 외우기 범위 고르기: 단어장 → Day 여러 개 → 방향 (#7)
export default function RangePicker({ onStart }: { onStart: (cards: StudyItem[]) => void }) {
  const [books, setBooks] = useState<BookSummary[] | null>(null);
  const [bookId, setBookId] = useState<number | null>(null);
  const [detail, setDetail] = useState<BookDetail | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [mix, setMix] = useState(true);
  const [direction, setDirection] = useState<StudyDirection>("en_ko");
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
      onStart(assignDirections(mix ? shuffle(deck) : deck, direction));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">외우기</h1>
        <p className="mt-1 text-base text-slate-500">외울 Day와 방향을 고르고, 떠올려 적어 보세요.</p>
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
              <h2 className="mb-3 text-lg font-semibold text-slate-800">단어장</h2>
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
                <h2 className="text-lg font-semibold text-slate-800">Day 고르기</h2>
                {days.length > 0 && (
                  <p className="text-base text-slate-500">여러 개를 고를 수 있어요</p>
                )}
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
              <h2 className="mb-3 text-lg font-semibold text-slate-800">방향</h2>
              <div className="grid grid-cols-3 gap-2">
                {directions.map((d) => (
                  <ChoiceButton key={d.value} selected={direction === d.value} onClick={() => setDirection(d.value)}>
                    <span className="block break-words">{d.label}</span>
                    <span className="block text-sm font-normal opacity-80">{d.hint}</span>
                  </ChoiceButton>
                ))}
              </div>
            </Panel>
          )}

          {bookId !== null && days.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex min-h-12 items-center gap-3 text-base text-slate-700">
                <input
                  type="checkbox"
                  checked={mix}
                  onChange={(e) => setMix(e.target.checked)}
                  className="size-6 accent-indigo-600"
                />
                섞어서 보기
              </label>
              <PrimaryButton type="button" disabled={picked.length === 0 || loading} onClick={start}>
                {loading ? "준비하는 중…" : picked.length === 0 ? "Day를 골라 주세요" : `외우기 시작 (${wordCount}단어)`}
              </PrimaryButton>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ChoiceButton({
  selected,
  children,
  ...props
}: { selected: boolean; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...props}
      className={`min-h-14 rounded-2xl border px-4 py-2 text-left text-base font-semibold disabled:opacity-40 ${
        selected
          ? "border-indigo-600 bg-indigo-600 text-white"
          : "border-slate-300 bg-white text-slate-700 hover:border-indigo-400"
      }`}
    >
      {children}
    </button>
  );
}
