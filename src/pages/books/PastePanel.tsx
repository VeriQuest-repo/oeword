import { useMemo, useState } from "react";
import { api, errorMessage } from "../../api";
import { ErrorText, inputClass, OutlineButton, PrimaryButton } from "../../components/ui";
import { groupRows, PASTE_MAX_WORDS, parseRows, type PasteRow, type PasteWord, toWordInputs } from "../../lib/paste";
import type { DayWords } from "../../lib/words";

// 엑셀에서 복사한 단어·품사·뜻 3칸을 붙여넣어 한 번에 넣기 (#6)
// 붙여넣기 → 미리보기(단어별로 묶임, 칸이 빠진 줄 표시·고치기) → 저장
export default function PastePanel({
  dayId,
  existing,
  onSaved,
}: {
  dayId: number;
  /** 이 Day 에 이미 있는 단어 (겹치면 알려 줌) */
  existing: string[];
  onSaved: (data: DayWords, count: number) => void;
}) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<PasteRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const words = useMemo(() => (rows ? groupRows(rows) : []), [rows]);
  const existingSet = useMemo(() => new Set(existing.map((w) => w.toLowerCase())), [existing]);
  const problemCount = words.reduce((n, w) => n + w.problems.length, 0);

  function preview(source = text) {
    const parsed = parseRows(source);
    setError(parsed.length === 0 ? "붙여넣은 내용에서 단어를 찾지 못했어요." : null);
    setRows(parsed.length === 0 ? null : parsed);
  }

  async function save() {
    if (problemCount > 0) return setError("빨간색으로 표시된 줄을 고치거나 빼 주세요.");
    const inputs = toWordInputs(words);
    if (inputs.length > PASTE_MAX_WORDS) return setError(`한 번에 ${PASTE_MAX_WORDS}단어까지 넣을 수 있어요.`);
    setBusy(true);
    setError(null);
    try {
      const data = await api.addWords(dayId, inputs);
      setRows(null);
      setText("");
      onSaved(data, inputs.length);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!rows) {
    return (
      <div className="space-y-4">
        <p className="text-base leading-relaxed text-slate-600">
          엑셀에서 <b>단어 · 품사 · 뜻</b> 3칸을 줄째로 골라 복사한 뒤 아래에 붙여넣어 주세요. 같은 단어가 여러 줄이면
          품사별로 한 단어에 묶여요. 뜻 칸의 쉼표(,)는 뜻을 나누는 표시로 읽어요.
        </p>
        <label htmlFor={`paste-${dayId}`} className="sr-only">
          붙여넣을 단어
        </label>
        <textarea
          id={`paste-${dayId}`}
          className={`${inputClass} min-h-48 py-3 font-mono text-base`}
          placeholder={"present\t명사\t선물, 현재\npresent\t형용사\t출석한, 현재의\ngive\t동사\t(~을) 주다"}
          spellCheck={false}
          autoCapitalize="none"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            // 빈 칸에 붙여넣으면 바로 미리보기를 보여 줍니다.
            const pasted = e.clipboardData.getData("text/plain");
            if (text.trim() === "" && pasted.trim() !== "") {
              e.preventDefault();
              setText(pasted);
              preview(pasted);
            }
          }}
        />
        <ErrorText message={error} />
        <PrimaryButton type="button" disabled={!text.trim()} onClick={() => preview()}>
          미리보기
        </PrimaryButton>
      </div>
    );
  }

  const updateRow = (line: number, change: Partial<PasteRow>) =>
    setRows((list) => list?.map((r) => (r.line === line ? { ...r, ...change, filledWord: false } : r)) ?? null);
  const removeRows = (lines: number[]) =>
    setRows((list) => {
      const next = list?.filter((r) => !lines.includes(r.line)) ?? [];
      return next.length === 0 ? null : next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-lg font-semibold text-slate-900">미리보기: 단어 {words.length}개</p>
        {problemCount > 0 ? (
          <p className="text-base font-medium text-rose-700">고칠 곳 {problemCount}개</p>
        ) : (
          <p className="text-base text-emerald-700">모두 저장할 수 있어요</p>
        )}
      </div>

      <ol className="space-y-3">
        {words.map((word, index) => (
          <PasteCard
            key={word.rows[0]!.line}
            index={index}
            word={word}
            duplicate={existingSet.has(word.text.toLowerCase())}
            onChangeRow={updateRow}
            onRemove={() => removeRows(word.rows.map((r) => r.line))}
          />
        ))}
      </ol>

      <ErrorText message={error} />
      <div className="flex flex-wrap gap-2">
        <PrimaryButton type="button" disabled={busy || problemCount > 0} onClick={save}>
          {words.length}단어 저장
        </PrimaryButton>
        <OutlineButton onClick={() => setRows(null)}>다시 붙여넣기</OutlineButton>
      </div>
    </div>
  );
}

function PasteCard({
  index,
  word,
  duplicate,
  onChangeRow,
  onRemove,
}: {
  index: number;
  word: PasteWord;
  duplicate: boolean;
  onChangeRow: (line: number, change: Partial<PasteRow>) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const hasProblem = word.problems.length > 0;
  const showRows = editing || hasProblem;

  return (
    <li
      className={`rounded-3xl bg-white p-4 ring-1 ${hasProblem ? "ring-2 ring-rose-300" : "ring-slate-200"}`}
    >
      <div className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 sm:grid-cols-[2rem_minmax(0,1fr)_auto]">
        <span className="pt-1 text-right text-base text-slate-400">{index + 1}</span>
        <div className="min-w-0">
          <p lang="en" className="break-words text-xl font-semibold text-slate-900">
            {word.text || <span className="text-rose-600">(단어 없음)</span>}
          </p>
          <ul className="mt-1 space-y-0.5">
            {word.senses.map((s) => (
              <li key={s.pos} className="break-words text-base text-slate-700">
                <span className="mr-2 rounded-md bg-indigo-50 px-2 py-0.5 text-sm font-medium text-indigo-700">
                  {s.pos}
                </span>
                {s.meanings.join(" · ")}
              </li>
            ))}
          </ul>
          {duplicate && <p className="mt-1 text-sm text-amber-700">이 Day에 이미 있는 단어예요. 두 번 넣지 않으려면 빼 주세요.</p>}
          {word.notes.map((note) => (
            <p key={note} className="mt-1 text-sm text-slate-500">
              {note}
            </p>
          ))}
          {word.problems.map((p) => (
            <p key={`${p.line}-${p.message}`} className="mt-1 text-sm font-medium text-rose-700">
              {p.line}번째 줄: {p.message}
            </p>
          ))}
        </div>
        <div className="col-start-2 flex gap-1 sm:col-start-3">
          {!hasProblem && (
            <OutlineButton onClick={() => setEditing((v) => !v)}>{editing ? "접기" : "고치기"}</OutlineButton>
          )}
          <OutlineButton className="text-rose-600" onClick={onRemove}>
            빼기
          </OutlineButton>
        </div>
      </div>

      {showRows && (
        <div className="mt-3 space-y-3 sm:pl-11">
          {word.rows.map((row) => (
            <fieldset
              key={row.line}
              className="grid gap-2 rounded-2xl bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1.5fr)]"
            >
              <legend className="sr-only">{row.line}번째 줄</legend>
              <input
                aria-label={`${row.line}번째 줄 단어`}
                className={inputClass}
                lang="en"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="단어"
                value={row.word}
                onChange={(e) => onChangeRow(row.line, { word: e.target.value })}
              />
              <input
                aria-label={`${row.line}번째 줄 품사`}
                className={inputClass}
                placeholder="품사"
                value={row.pos}
                onChange={(e) => onChangeRow(row.line, { pos: e.target.value })}
              />
              <input
                aria-label={`${row.line}번째 줄 뜻`}
                className={inputClass}
                placeholder="뜻 (쉼표로 여러 개)"
                value={row.meaning}
                onChange={(e) => onChangeRow(row.line, { meaning: e.target.value })}
              />
            </fieldset>
          ))}
        </div>
      )}
    </li>
  );
}
