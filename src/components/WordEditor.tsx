import { type FormEvent, type KeyboardEvent, useRef, useState } from "react";
import {
  checkWordInput,
  MEANING_MAX_LENGTH,
  MEANING_PER_SENSE_MAX_COUNT,
  POS_MAX_LENGTH,
  POS_OPTIONS,
  SENSE_MAX_COUNT,
  splitMeanings,
  type WordInput,
  WORD_MAX_LENGTH,
} from "../lib/words";
import { ErrorText, inputClass, OutlineButton, PrimaryButton } from "./ui";

interface SenseDraft {
  key: number;
  pos: string;
  /** 목록에 없는 품사를 직접 적는 중인지 */
  custom: boolean;
  meanings: { key: number; text: string }[];
}

let nextKey = 1;
const key = () => nextKey++;

function toDrafts(input: WordInput | null): SenseDraft[] {
  if (!input || input.senses.length === 0) return [emptySense()];
  return input.senses.map((s) => ({
    key: key(),
    pos: s.pos,
    custom: !(POS_OPTIONS as readonly string[]).includes(s.pos),
    meanings: s.meanings.map((text) => ({ key: key(), text })),
  }));
}

function emptySense(): SenseDraft {
  return { key: key(), pos: "", custom: false, meanings: [{ key: key(), text: "" }] };
}

const CUSTOM = "__custom__";

/**
 * 단어 하나 입력·수정 (#5). 품사와 뜻을 자유롭게 늘리고 줄일 수 있습니다.
 * - 입력칸에서 Enter(완료·다음)를 누르면 다음 칸으로, 마지막 칸이면 저장합니다.
 * - 패드·폰에서 손가락·펜슬로 쓰기 쉽게 칸과 버튼을 크게 만듭니다.
 */
export default function WordEditor({
  initial = null,
  submitLabel,
  onSave,
  onCancel,
  autoFocus = false,
  resetAfterSave = false,
}: {
  initial?: WordInput | null;
  submitLabel: string;
  /** 저장에 성공하면 true (실패 문구는 error 로 돌려줌) */
  onSave: (input: WordInput) => Promise<true | string>;
  onCancel?: () => void;
  autoFocus?: boolean;
  /** 저장 후 칸을 비우고 단어 칸으로 돌아갑니다 (새 단어 넣기). */
  resetAfterSave?: boolean;
}) {
  const [text, setText] = useState(initial?.text ?? "");
  const [senses, setSenses] = useState<SenseDraft[]>(() => toDrafts(initial));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const wordRef = useRef<HTMLInputElement>(null);

  const updateSense = (senseKey: number, change: (s: SenseDraft) => SenseDraft) =>
    setSenses((list) => list.map((s) => (s.key === senseKey ? change(s) : s)));

  /** 뜻 칸에 쉼표·세미콜론으로 여러 뜻을 적었으면 칸을 나눠 보여 줍니다 (#34). 괄호 안은 나누지 않습니다. */
  function splitMeaningField(senseKey: number, meaningKey: number) {
    updateSense(senseKey, (s) => {
      const index = s.meanings.findIndex((m) => m.key === meaningKey);
      const parts = index < 0 ? [] : splitMeanings(s.meanings[index]!.text);
      if (parts.length < 2) return s;
      const pieces = parts.map((part, i) => ({ key: i === 0 ? meaningKey : key(), text: part }));
      const meanings = [...s.meanings.slice(0, index), ...pieces, ...s.meanings.slice(index + 1)];
      return { ...s, meanings: meanings.slice(0, MEANING_PER_SENSE_MAX_COUNT) };
    });
  }

  /** 방금 추가한 칸으로 커서를 옮깁니다. */
  function focusLater(selector: string) {
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(selector)?.focus());
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const checked = checkWordInput({
      text,
      senses: senses.map((s) => ({ pos: s.pos, meanings: s.meanings.map((m) => m.text) })),
    });
    if (!checked.ok) return setError(checked.message);
    setBusy(true);
    setError(null);
    const result = await onSave(checked.value);
    setBusy(false);
    if (result !== true) return setError(result);
    if (resetAfterSave) {
      setText("");
      setSenses([emptySense()]);
      wordRef.current?.focus();
    }
  }

  /** Enter: 다음 입력칸으로. 한글 조합 중인 Enter 는 건드리지 않습니다. */
  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    const target = event.target as HTMLElement;
    if (target.tagName !== "INPUT") return;
    event.preventDefault();
    const fields = [...(formRef.current?.querySelectorAll<HTMLElement>("input, select") ?? [])];
    const next = fields[fields.indexOf(target) + 1];
    if (next) next.focus();
    else void submit();
  }

  return (
    <form ref={formRef} onSubmit={submit} onKeyDown={onKeyDown} className="space-y-4">
      <div>
        <label htmlFor={`word-${senses[0]?.key}`} className="mb-1 block text-sm font-medium text-slate-600">
          단어
        </label>
        <input
          id={`word-${senses[0]?.key}`}
          ref={wordRef}
          className={`${inputClass} text-xl`}
          lang="en"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="next"
          maxLength={WORD_MAX_LENGTH}
          placeholder="예: present"
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      <ol className="space-y-4">
        {senses.map((sense, senseIndex) => (
          <li key={sense.key} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 sm:p-4">
            <div className="grid gap-3 md:grid-cols-[11rem_1fr]">
              <div className="space-y-2">
                <label htmlFor={`pos-${sense.key}`} className="block text-sm font-medium text-slate-600">
                  품사 {senses.length > 1 ? senseIndex + 1 : ""}
                </label>
                <select
                  id={`pos-${sense.key}`}
                  data-pos={sense.key}
                  className={inputClass}
                  value={sense.custom ? CUSTOM : sense.pos}
                  onChange={(e) => {
                    const value = e.target.value;
                    updateSense(sense.key, (s) =>
                      value === CUSTOM ? { ...s, custom: true, pos: "" } : { ...s, custom: false, pos: value },
                    );
                    if (value === CUSTOM) focusLater(`[data-custom-pos="${sense.key}"]`);
                    else focusLater(`[data-meaning-of="${sense.key}"]`);
                  }}
                >
                  <option value="" disabled>
                    품사 고르기
                  </option>
                  {POS_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                  <option value={CUSTOM}>직접 적기</option>
                </select>
                {sense.custom && (
                  <input
                    aria-label="품사 직접 적기"
                    data-custom-pos={sense.key}
                    className={inputClass}
                    maxLength={POS_MAX_LENGTH}
                    enterKeyHint="next"
                    placeholder="예: 구동사"
                    value={sense.pos}
                    onChange={(e) => updateSense(sense.key, (s) => ({ ...s, pos: e.target.value }))}
                  />
                )}
              </div>

              <div className="min-w-0 space-y-2">
                <span className="block text-sm font-medium text-slate-600">뜻</span>
                {senseIndex === 0 && (
                  <p className="text-sm text-slate-500">쉼표(,)로 적으면 뜻 칸이 나뉘어요. 괄호 안 쉼표는 그대로 둬요.</p>
                )}
                {sense.meanings.map((meaning, meaningIndex) => (
                  <div key={meaning.key} className="flex gap-2">
                    <input
                      aria-label={`뜻 ${meaningIndex + 1}`}
                      data-meaning-of={meaningIndex === 0 ? sense.key : undefined}
                      data-meaning={meaning.key}
                      className={inputClass}
                      lang="ko"
                      autoComplete="off"
                      enterKeyHint="next"
                      maxLength={MEANING_MAX_LENGTH}
                      placeholder={meaningIndex === 0 ? "예: (~을) 주다" : "뜻 하나 더"}
                      value={meaning.text}
                      onChange={(e) =>
                        updateSense(sense.key, (s) => ({
                          ...s,
                          meanings: s.meanings.map((m) => (m.key === meaning.key ? { ...m, text: e.target.value } : m)),
                        }))
                      }
                      onBlur={() => splitMeaningField(sense.key, meaning.key)}
                    />
                    {sense.meanings.length > 1 && (
                      <button
                        type="button"
                        aria-label={`뜻 ${meaningIndex + 1} 빼기`}
                        className="min-h-14 min-w-12 shrink-0 rounded-2xl text-2xl text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                        onClick={() =>
                          updateSense(sense.key, (s) => ({
                            ...s,
                            meanings: s.meanings.filter((m) => m.key !== meaning.key),
                          }))
                        }
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <OutlineButton
                    disabled={sense.meanings.length >= MEANING_PER_SENSE_MAX_COUNT}
                    onClick={() => {
                      const added = key();
                      updateSense(sense.key, (s) => ({ ...s, meanings: [...s.meanings, { key: added, text: "" }] }));
                      focusLater(`[data-meaning="${added}"]`);
                    }}
                  >
                    + 뜻 추가
                  </OutlineButton>
                  {senses.length > 1 && (
                    <OutlineButton
                      className="text-slate-500"
                      onClick={() => setSenses((list) => list.filter((s) => s.key !== sense.key))}
                    >
                      이 품사 빼기
                    </OutlineButton>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <OutlineButton
        disabled={senses.length >= SENSE_MAX_COUNT}
        onClick={() => {
          const added = emptySense();
          setSenses((list) => [...list, added]);
          focusLater(`[data-pos="${added.key}"]`);
        }}
      >
        + 품사 추가
      </OutlineButton>

      <ErrorText message={error} />

      <div className="flex flex-wrap gap-2">
        <PrimaryButton type="submit" disabled={busy}>
          {submitLabel}
        </PrimaryButton>
        {onCancel && <OutlineButton onClick={onCancel}>취소</OutlineButton>}
      </div>
    </form>
  );
}
