import { type ButtonHTMLAttributes, type ReactNode, useEffect, useState } from "react";
import { api, errorMessage } from "../../api";
import { ErrorText, Panel, PrimaryButton } from "../../components/ui";
import { type BookDetail, type BookSummary, dayLabel } from "../../lib/books";
import { CHOICE_COUNT } from "../../lib/choices";
import {
  assignDirections,
  buildDeck,
  shuffle,
  STAGES,
  type StudyCard,
  type StudyDirection,
  type StudyItem,
  type StudyStage,
} from "../../lib/study";

export interface StudyPlan {
  stage: StudyStage;
  all: StudyItem[];
  /** 객관식 오답 후보: 고른 범위의 단어 */
  range: StudyCard[];
  /** 범위만으로 모자랄 때 쓸 같은 단어장의 다른 Day 단어 (객관식일 때만 불러옴) */
  extra: StudyCard[];
}

const directions: { value: StudyDirection; label: string; hint: string }[] = [
  { value: "en_ko", label: "영단어", hint: "영단어 보고 뜻 쓰기" },
  { value: "ko_en", label: "뜻", hint: "뜻 보고 영단어 쓰기" },
  { value: "mixed", label: "영단어/뜻", hint: "반반 섞어서" },
];

// 외우기 고르기: 단어장 → Day 여러 개 → 방향 → 단계 (#7, #42, #43)
export default function RangePicker({ onStart }: { onStart: (plan: StudyPlan) => void }) {
  const [books, setBooks] = useState<BookSummary[] | null>(null);
  const [bookId, setBookId] = useState<number | null>(null);
  const [detail, setDetail] = useState<BookDetail | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [mix, setMix] = useState(true);
  const [direction, setDirection] = useState<StudyDirection>("en_ko");
  const [stage, setStage] = useState<StudyStage>("blind");
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
  const bookWordCount = days.reduce((sum, d) => sum + d.wordCount, 0);
  // 보기를 만들 다른 단어가 없으면 객관식을 고를 수 없습니다.
  const choiceDisabled = bookWordCount < 2;
  const chosenStage = stage === "choice" && choiceDisabled ? "blind" : stage;

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
      let extra: StudyCard[] = [];
      // 범위 안 단어만으로 오답이 모자랄 수 있으면 같은 단어장의 다른 Day도 불러옵니다.
      if (chosenStage === "choice" && deck.length < CHOICE_COUNT * 2) {
        const others = days.filter((d) => !picked.includes(d.id) && d.wordCount > 0);
        extra = buildDeck(await Promise.all(others.map((d) => api.dayWords(d.id))));
      }
      onStart({ stage: chosenStage, all: assignDirections(mix ? shuffle(deck) : deck, direction), range: deck, extra });
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
        <p className="mt-1 text-base text-slate-500">외울 Day와 방향, 단계를 고르세요. 가리기 → 객관식 → 주관식 순서로 하면 쉬워요.</p>
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
            <Panel>
              <h2 className="mb-3 text-lg font-semibold text-slate-800">단계</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {STAGES.map((st, i) => {
                  const disabled = st.value === "choice" && choiceDisabled;
                  return (
                    <ChoiceButton
                      key={st.value}
                      selected={chosenStage === st.value}
                      disabled={disabled}
                      onClick={() => setStage(st.value)}
                    >
                      <span className="block break-words">
                        {i + 1}. {st.label}
                      </span>
                      <span className="block text-sm font-normal opacity-80">
                        {disabled ? "단어가 2개 이상 있어야 해요" : st.hint}
                      </span>
                    </ChoiceButton>
                  );
                })}
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
