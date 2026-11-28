import { type ReactNode, useState } from "react";
import { BackButton } from "../../components/ui";
import { dayLabel } from "../../lib/books";
import type { DayWords, WordView } from "../../lib/words";

type Hide = "none" | "meaning" | "word";

const hideOptions: { value: Hide; label: string }[] = [
  { value: "none", label: "모두 보기" },
  { value: "meaning", label: "뜻 가리기" },
  { value: "word", label: "영단어 가리기" },
];

// 고른 Day의 단어를 목록으로 쭉 보기 (#51). 보기 전용이라 완료 기록에는 세지 않습니다.
// 뜻이나 영단어를 가리고, 가린 칸을 누르면 그 칸만 보입니다.
export default function WordListView({ days, onBack }: { days: DayWords[]; onBack: () => void }) {
  const [hide, setHide] = useState<Hide>("none");
  // 가린 상태에서 눌러 연 단어 (단어 id)
  const [opened, setOpened] = useState<Set<number>>(new Set());
  const total = days.reduce((sum, d) => sum + d.words.length, 0);

  function chooseHide(value: Hide) {
    setHide(value);
    setOpened(new Set());
  }

  function toggle(id: number) {
    setOpened((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <BackButton onClick={onBack}>외우기 고르기</BackButton>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">단어 목록</h1>
        <p className="mt-1 text-base text-slate-500">
          {days.map((d) => dayLabel(d.day)).join(", ")} · {total}단어
        </p>
      </div>

      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap gap-2 bg-slate-50/95 px-1 py-2 backdrop-blur" role="radiogroup" aria-label="가리기">
        {hideOptions.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={hide === o.value}
            onClick={() => chooseHide(o.value)}
            className={`min-h-12 rounded-2xl border-2 px-4 text-base font-semibold ${
              hide === o.value
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-indigo-400"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hide !== "none" && <p className="text-base text-slate-500">가린 칸을 누르면 보여요. 다시 누르면 가려져요.</p>}

      {days.map(({ day, words }) => (
        <section key={day.id} className="rounded-3xl bg-white ring-1 ring-slate-200">
          <h2 className="border-b border-slate-200 px-5 py-3 text-lg font-bold text-slate-800">
            {dayLabel(day)} <span className="text-base font-normal text-slate-500">· {words.length}단어</span>
          </h2>
          {words.length === 0 ? (
            <p className="px-5 py-4 text-base text-slate-500">단어가 없어요.</p>
          ) : (
            <ol className="divide-y divide-slate-100">
              {words.map((w, i) => (
                <Row key={w.id} index={i + 1} word={w} hide={hide} opened={opened.has(w.id)} onToggle={() => toggle(w.id)} />
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}

function Row({
  index,
  word,
  hide,
  opened,
  onToggle,
}: {
  index: number;
  word: WordView;
  hide: Hide;
  opened: boolean;
  onToggle: () => void;
}) {
  const wordHidden = hide === "word" && !opened;
  const meaningHidden = hide === "meaning" && !opened;
  const text = (
    <span lang="en" className="break-words text-2xl font-bold text-slate-900">
      {word.text}
    </span>
  );
  const meanings = (
    <ul className="space-y-1">
      {word.senses.map((s) => (
        <li key={s.pos} className="flex items-baseline gap-2 text-lg text-slate-900">
          <span className="shrink-0 text-base italic text-slate-500">{s.pos}</span>
          <span className="min-w-0 break-words font-medium">{s.meanings.join(", ")}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 gap-y-2 px-5 py-4 sm:grid-cols-[2rem_minmax(0,2fr)_minmax(0,3fr)] sm:items-baseline sm:gap-x-4">
      <span className="text-base text-slate-400">{index}</span>
      <Cell hidden={wordHidden} interactive={hide === "word"} onToggle={onToggle} label="영단어 보기">
        {text}
      </Cell>
      <div className="col-start-2 sm:col-start-auto">
        <Cell hidden={meaningHidden} interactive={hide === "meaning"} onToggle={onToggle} label="뜻 보기">
          {meanings}
        </Cell>
      </div>
    </li>
  );
}

function Cell({
  hidden,
  interactive,
  onToggle,
  label,
  children,
}: {
  hidden: boolean;
  interactive: boolean;
  onToggle: () => void;
  label: string;
  children: ReactNode;
}) {
  if (!interactive) return <div>{children}</div>;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={hidden ? label : undefined}
      className={`block min-h-11 w-full rounded-xl px-2 py-1 text-left ${
        hidden ? "border-2 border-dashed border-slate-300 bg-slate-100" : "hover:bg-indigo-50"
      }`}
    >
      {hidden ? <span className="text-base text-slate-500">눌러서 보기</span> : children}
    </button>
  );
}
