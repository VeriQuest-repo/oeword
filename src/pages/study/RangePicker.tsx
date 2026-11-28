import { type ButtonHTMLAttributes, type ReactNode, useEffect, useState } from "react";
import { api, errorMessage } from "../../api";
import { ErrorText, OutlineButton, Panel, PrimaryButton } from "../../components/ui";
import { type BookDetail, type BookSummary, dayLabel } from "../../lib/books";
import { CHOICE_COUNT } from "../../lib/choices";
import type { MemberSummary } from "../../lib/session";
import type { DayWords } from "../../lib/words";
import {
  assignDirections,
  buildDeck,
  EMPTY_COUNTS,
  recommendStage,
  shuffle,
  type StageCounts,
  STAGES,
  type StudyCard,
  type StudyDirection,
  type StudyItem,
  type StudyStage,
} from "../../lib/study";
import WordListView from "./WordListView";

export interface StudyPlan {
  stage: StudyStage;
  direction: StudyDirection;
  dayIds: number[];
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
export default function RangePicker({
  member,
  members,
  onStart,
}: {
  member: MemberSummary;
  members: MemberSummary[];
  onStart: (plan: StudyPlan) => void;
}) {
  const students = members.filter((m) => m.role === "student");
  // 학생은 자기 기록, 보호자는 고른 아이의 기록을 봅니다 (#44).
  const [studentId, setStudentId] = useState<number | null>(
    member.role === "student" ? member.id : (students[0]?.id ?? null),
  );
  const [records, setRecords] = useState<Map<number, StageCounts>>(new Map());
  const [books, setBooks] = useState<BookSummary[] | null>(null);
  const [bookId, setBookId] = useState<number | null>(null);
  const [detail, setDetail] = useState<BookDetail | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [mix, setMix] = useState(true);
  const [direction, setDirection] = useState<StudyDirection>("en_ko");
  // 학생이 직접 고른 단계. 고른 Day·추천이 바뀌면 다시 추천 단계로 돌아갑니다.
  const [manual, setManual] = useState<{ key: string; stage: StudyStage } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "목록으로 보기"로 연 Day 단어들 (#51). 돌아오면 고른 Day·방향·단계가 그대로 남습니다.
  const [listDays, setListDays] = useState<DayWords[] | null>(null);

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

  useEffect(() => {
    if (bookId === null || studentId === null) return;
    let alive = true;
    api
      .studyRecords(bookId, studentId)
      .then(({ days: list }) => {
        if (alive) setRecords(new Map(list.map(({ dayId, ...counts }) => [dayId, counts])));
      })
      .catch((e) => setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [bookId, studentId]);

  const days = detail?.days ?? [];
  const pickedDays = days.filter((d) => picked.includes(d.id));
  const wordCount = pickedDays.reduce((sum, d) => sum + d.wordCount, 0);
  const bookWordCount = days.reduce((sum, d) => sum + d.wordCount, 0);
  // 보기를 만들 다른 단어가 없으면 객관식을 고를 수 없습니다.
  const choiceDisabled = bookWordCount < 2;
  const countsOf = (dayId: number) => records.get(dayId) ?? EMPTY_COUNTS;
  const recommended = recommendStage(pickedDays.map((d) => countsOf(d.id)), !choiceDisabled);
  const recommendKey = `${picked.join(",")}|${recommended}`;
  // '추천' 단계를 먼저 골라 두고, 학생이 다른 단계를 고르면 그걸 씁니다.
  const stage = manual?.key === recommendKey ? manual.stage : recommended;
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
      onStart({
        stage: chosenStage,
        direction,
        dayIds: pickedDays.map((d) => d.id),
        all: assignDirections(mix ? shuffle(deck) : deck, direction), range: deck,
        extra,
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function openList() {
    setLoading(true);
    setError(null);
    try {
      const list = await Promise.all(pickedDays.map((d) => api.dayWords(d.id)));
      // oxlint-disable-next-line unicorn/no-array-sort
      setListDays([...list].sort((a, b) => a.day.dayNumber - b.day.dayNumber));
      window.scrollTo(0, 0);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  if (listDays) return <WordListView days={listDays} onBack={() => setListDays(null)} />;

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

          {member.role !== "student" && students.length > 0 && (
            <Panel>
              <h2 className="mb-1 text-lg font-semibold text-slate-800">누구의 기록을 볼까요?</h2>
              <p className="mb-3 text-base text-slate-500">Day마다 단계별 완료 횟수가 보여요. 보호자가 외운 것은 기록되지 않아요.</p>
              <div className="flex flex-wrap gap-2">
                {students.map((st) => (
                  <ChoiceButton key={st.id} selected={st.id === studentId} onClick={() => setStudentId(st.id)}>
                    {st.name}
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
                      {studentId !== null && <StageCountLine counts={countsOf(d.id)} selected={picked.includes(d.id)} />}
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
                      onClick={() => setManual({ key: recommendKey, stage: st.value })}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="break-words">
                          {i + 1}. {st.label}
                        </span>
                        {picked.length > 0 && st.value === recommended && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                              chosenStage === st.value ? "bg-white text-indigo-700" : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            추천
                          </span>
                        )}
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
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <OutlineButton disabled={picked.length === 0 || loading} onClick={openList} className="min-h-14 text-lg">
                  목록으로 보기
                </OutlineButton>
                <PrimaryButton type="button" disabled={picked.length === 0 || loading} onClick={start}>
                  {loading ? "준비하는 중…" : picked.length === 0 ? "Day를 골라 주세요" : `외우기 시작 (${wordCount}단어)`}
                </PrimaryButton>
              </div>
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

/** Day 버튼 안의 단계별 완료 횟수 (#44). 보호자도 한눈에 찾게 크고 진하게 보여 줍니다 (#49). */
function StageCountLine({ counts, selected }: { counts: StageCounts; selected: boolean }) {
  return (
    <span
      className={`mt-2 flex flex-wrap gap-x-2 gap-y-0.5 rounded-lg px-2 py-1 text-sm font-medium ${
        selected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-800"
      }`}
    >
      {STAGES.map((st) => (
        <span key={st.value} className="whitespace-nowrap">
          {st.label} <b className="text-base font-bold">{counts[st.value]}</b>
        </span>
      ))}
    </span>
  );
}
