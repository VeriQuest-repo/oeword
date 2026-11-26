import { useEffect, useState } from "react";
import { api, errorMessage } from "../../api";
import WordEditor from "../../components/WordEditor";
import { BackButton, ConfirmButton, ErrorText, OutlineButton, Panel } from "../../components/ui";
import { dayLabel } from "../../lib/books";
import PastePanel from "./PastePanel";
import type { DayWords, WordView } from "../../lib/words";

// Day 하나의 단어: 직접 입력·고치기·삭제 (#5), 엑셀 붙여넣기 (#6)
export default function DayView({ dayId, onBack }: { dayId: number; onBack: (bookId: number | null) => void }) {
  const [data, setData] = useState<DayWords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [mode, setMode] = useState<"type" | "paste">("type");

  useEffect(() => {
    api
      .dayWords(dayId)
      .then(setData)
      .catch((e) => setError(errorMessage(e)));
  }, [dayId]);

  const setWords = (change: (words: WordView[]) => WordView[]) =>
    setData((d) => (d ? { ...d, words: change(d.words) } : d));

  if (!data) {
    return (
      <div>
        <BackButton onClick={() => onBack(null)}>단어장</BackButton>
        {error ? <ErrorText message={error} /> : <p className="text-base text-slate-400">불러오는 중…</p>}
      </div>
    );
  }

  const { day, words } = data;

  async function add(input: Parameters<typeof api.addWord>[1]): Promise<true | string> {
    try {
      const { word } = await api.addWord(day.id, input);
      setWords((list) => [...list, word]);
      setSaved(`"${word.text}" 저장했어요.`);
      return true;
    } catch (e) {
      return errorMessage(e);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <BackButton onClick={() => onBack(day.bookId)}>{data.day.bookTitle}</BackButton>
        <h1 className="break-words text-2xl font-bold text-slate-900 sm:text-3xl">{dayLabel(day)}</h1>
        <p className="mt-1 text-base text-slate-500">단어 {words.length}개</p>
      </div>

      <ErrorText message={error} />

      <Panel>
        <div role="tablist" aria-label="단어 넣는 방법" className="mb-4 flex gap-1 rounded-2xl bg-slate-100 p-1">
          {(
            [
              ["type", "직접 입력"],
              ["paste", "엑셀 붙여넣기"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              onClick={() => {
                setMode(key);
                setSaved(null);
              }}
              className={`min-h-12 flex-1 rounded-xl px-3 text-base font-semibold ${
                mode === key ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === "type" ? (
          <WordEditor submitLabel="저장하고 다음 단어" resetAfterSave onSave={add} />
        ) : (
          <PastePanel
            dayId={day.id}
            existing={words.map((w) => w.text)}
            onSaved={(next, count) => {
              setData(next);
              setSaved(`${count}단어 저장했어요.`);
            }}
          />
        )}
        {saved && (
          <p role="status" className="mt-3 text-base text-emerald-700">
            {saved}
          </p>
        )}
      </Panel>

      {words.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-base text-slate-600 ring-1 ring-slate-200">
          아직 단어가 없어요. 위에서 첫 단어를 넣어 주세요.
        </p>
      ) : (
        <ol className="space-y-3">
          {words.map((word, index) =>
            word.id === editingId ? (
              <li key={word.id} className="rounded-3xl bg-white p-4 ring-2 ring-indigo-300 sm:p-6">
                <WordEditor
                  initial={word}
                  submitLabel="고친 내용 저장"
                  autoFocus
                  onCancel={() => setEditingId(null)}
                  onSave={async (input) => {
                    try {
                      const { word: updated } = await api.updateWord(word.id, input);
                      setWords((list) => list.map((w) => (w.id === word.id ? updated : w)));
                      setEditingId(null);
                      return true;
                    } catch (e) {
                      return errorMessage(e);
                    }
                  }}
                />
              </li>
            ) : (
              <WordRow
                key={word.id}
                index={index}
                word={word}
                onEdit={() => setEditingId(word.id)}
                onDelete={async () => {
                  setError(null);
                  try {
                    await api.deleteWord(word.id);
                    setWords((list) => list.filter((w) => w.id !== word.id));
                  } catch (e) {
                    setError(errorMessage(e));
                  }
                }}
              />
            ),
          )}
        </ol>
      )}
    </div>
  );
}

function WordRow({
  index,
  word,
  onEdit,
  onDelete,
}: {
  index: number;
  word: WordView;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 rounded-3xl bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-[2rem_minmax(0,1fr)_auto]">
      <span className="pt-1 text-right text-base text-slate-400">{index + 1}</span>
      <div className="min-w-0">
        <p lang="en" className="break-words text-xl font-semibold text-slate-900">
          {word.text}
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
      </div>
      <div className="col-start-2 flex gap-1 sm:col-start-3">
        <OutlineButton onClick={onEdit}>고치기</OutlineButton>
        <ConfirmButton onConfirm={onDelete} />
      </div>
    </li>
  );
}
