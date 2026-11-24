import { type FormEvent, useEffect, useState } from "react";
import { api, errorMessage } from "../../api";
import {
  BackButton,
  ConfirmButton,
  ErrorText,
  inputClass,
  OutlineButton,
  Panel,
  PrimaryButton,
} from "../../components/ui";
import {
  BOOK_TITLE_MAX_LENGTH,
  type BookDetail,
  checkBookTitle,
  DAY_TITLE_MAX_LENGTH,
  dayLabel,
  type DaySummary,
} from "../../lib/books";

// 단어장 한 권: 이름 바꾸기, 보관, Day 추가·고치기·순서 바꾸기·삭제 (#4)
export default function BookView({
  bookId,
  onBack,
  onOpenDay,
}: {
  bookId: number;
  onBack: () => void;
  onOpenDay?: (day: DaySummary) => void;
}) {
  const [detail, setDetail] = useState<BookDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .book(bookId)
      .then(setDetail)
      .catch((e) => setError(errorMessage(e)));
  }, [bookId]);

  /** 서버에 고친 뒤 돌아온 최신 단어장으로 화면을 바꿉니다. 성공하면 true. */
  async function run(action: () => Promise<BookDetail>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      setDetail(await action());
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!detail) {
    return (
      <div>
        <BackButton onClick={onBack}>단어장 목록</BackButton>
        {error ? <ErrorText message={error} /> : <p className="text-base text-slate-400">불러오는 중…</p>}
      </div>
    );
  }

  const { book, days } = detail;
  const nextNumber = days.length === 0 ? 1 : Math.max(...days.map((d) => d.dayNumber)) + 1;

  return (
    <div className="space-y-6">
      <div>
        <BackButton onClick={onBack}>단어장 목록</BackButton>
        <BookTitle
          title={book.title}
          archived={book.archived}
          busy={busy}
          onRename={(title) => run(() => api.updateBook(book.id, { title }))}
          onArchive={(archived) => run(() => api.updateBook(book.id, { archived }))}
          onError={setError}
        />
        <p className="mt-1 text-base text-slate-500">
          Day {book.dayCount}개 · 단어 {book.wordCount}개
        </p>
      </div>

      <ErrorText message={error} />

      <AddDayForm
        nextNumber={nextNumber}
        busy={busy}
        onAdd={(input) => run(() => api.createDay(book.id, input))}
      />

      {days.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-base text-slate-600 ring-1 ring-slate-200">
          아직 Day가 없어요. 위에서 Day를 추가해 주세요.
        </p>
      ) : (
        <ul className="space-y-3">
          {days.map((day, index) => (
            <DayRow
              key={day.id}
              day={day}
              first={index === 0}
              last={index === days.length - 1}
              busy={busy}
              onOpen={onOpenDay}
              onMove={(direction) => run(() => api.moveDay(day.id, direction))}
              onSave={(change) => run(() => api.updateDay(day.id, change))}
              onDelete={() => run(() => api.deleteDay(day.id))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function BookTitle({
  title,
  archived,
  busy,
  onRename,
  onArchive,
  onError,
}: {
  title: string;
  archived: boolean;
  busy: boolean;
  onRename: (title: string) => Promise<boolean>;
  onArchive: (archived: boolean) => Promise<boolean>;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  async function save(event: FormEvent) {
    event.preventDefault();
    const checked = checkBookTitle(draft);
    if (!checked.ok) return onError(checked.message);
    if (await onRename(checked.value)) setEditing(false);
  }

  if (editing) {
    return (
      <form onSubmit={save} className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="book-title">
          단어장 이름
        </label>
        <input
          id="book-title"
          className={inputClass}
          maxLength={BOOK_TITLE_MAX_LENGTH}
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="flex shrink-0 gap-2">
          <PrimaryButton type="submit" disabled={busy}>
            저장
          </PrimaryButton>
          <OutlineButton onClick={() => setEditing(false)}>취소</OutlineButton>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h1 className="min-w-0 break-words text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
      {archived && <span className="rounded-md bg-slate-200 px-2 py-0.5 text-sm text-slate-600">보관됨</span>}
      <div className="flex gap-2">
        <OutlineButton
          onClick={() => {
            setDraft(title);
            setEditing(true);
          }}
        >
          이름 바꾸기
        </OutlineButton>
        <OutlineButton disabled={busy} onClick={() => onArchive(!archived)}>
          {archived ? "다시 꺼내기" : "보관하기"}
        </OutlineButton>
      </div>
    </div>
  );
}

function AddDayForm({
  nextNumber,
  busy,
  onAdd,
}: {
  nextNumber: number;
  busy: boolean;
  onAdd: (input: { dayNumber?: string; title?: string }) => Promise<boolean>;
}) {
  const [dayNumber, setDayNumber] = useState("");
  const [title, setTitle] = useState("");

  async function add(event: FormEvent) {
    event.preventDefault();
    if (await onAdd({ dayNumber: dayNumber || undefined, title })) {
      setDayNumber("");
      setTitle("");
    }
  }

  return (
    <Panel>
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-[8rem_1fr_auto]">
        <div>
          <label htmlFor="new-day-number" className="mb-1 block text-sm font-medium text-slate-600">
            Day 번호
          </label>
          <input
            id="new-day-number"
            className={inputClass}
            inputMode="numeric"
            placeholder={String(nextNumber)}
            value={dayNumber}
            onChange={(e) => setDayNumber(e.target.value.replace(/\D/g, "").slice(0, 3))}
          />
        </div>
        <div>
          <label htmlFor="new-day-title" className="mb-1 block text-sm font-medium text-slate-600">
            제목 (없어도 돼요)
          </label>
          <input
            id="new-day-title"
            className={inputClass}
            maxLength={DAY_TITLE_MAX_LENGTH}
            placeholder="예: 동물"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <PrimaryButton type="submit" disabled={busy} className="self-end">
          Day 추가
        </PrimaryButton>
      </form>
    </Panel>
  );
}

function DayRow({
  day,
  first,
  last,
  busy,
  onOpen,
  onMove,
  onSave,
  onDelete,
}: {
  day: DaySummary;
  first: boolean;
  last: boolean;
  busy: boolean;
  onOpen?: (day: DaySummary) => void;
  onMove: (direction: "up" | "down") => void;
  onSave: (change: { dayNumber: string; title: string }) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [dayNumber, setDayNumber] = useState(String(day.dayNumber));
  const [title, setTitle] = useState(day.title ?? "");

  async function save(event: FormEvent) {
    event.preventDefault();
    if (await onSave({ dayNumber, title })) setEditing(false);
  }

  if (editing) {
    return (
      <li className="rounded-3xl bg-white p-4 ring-2 ring-indigo-300">
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-[8rem_1fr_auto]">
          <div>
            <label htmlFor={`day-${day.id}-number`} className="mb-1 block text-sm font-medium text-slate-600">
              Day 번호
            </label>
            <input
              id={`day-${day.id}-number`}
              className={inputClass}
              inputMode="numeric"
              value={dayNumber}
              onChange={(e) => setDayNumber(e.target.value.replace(/\D/g, "").slice(0, 3))}
            />
          </div>
          <div>
            <label htmlFor={`day-${day.id}-title`} className="mb-1 block text-sm font-medium text-slate-600">
              제목
            </label>
            <input
              id={`day-${day.id}-title`}
              className={inputClass}
              maxLength={DAY_TITLE_MAX_LENGTH}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex gap-2 self-end">
            <PrimaryButton type="submit" disabled={busy}>
              저장
            </PrimaryButton>
            <OutlineButton onClick={() => setEditing(false)}>취소</OutlineButton>
          </div>
        </form>
      </li>
    );
  }

  const label = (
    <>
      <span className="block break-words text-lg font-semibold text-slate-900">{dayLabel(day)}</span>
      <span className="block text-base text-slate-500">단어 {day.wordCount}개</span>
    </>
  );

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-3xl bg-white p-3 ring-1 ring-slate-200 sm:flex-nowrap sm:p-4">
      {onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(day)}
          className="flex min-h-14 min-w-0 flex-1 basis-full items-center gap-2 rounded-2xl px-2 text-left hover:bg-indigo-50 sm:basis-auto"
        >
          <span className="min-w-0 flex-1">{label}</span>
          <span aria-hidden className="text-2xl text-slate-300">
            ›
          </span>
        </button>
      ) : (
        <div className="min-w-0 flex-1 basis-full px-2 sm:basis-auto">{label}</div>
      )}
      <div className="flex flex-wrap items-center gap-1">
        <OutlineButton aria-label={`${dayLabel(day)} 위로`} disabled={busy || first} onClick={() => onMove("up")}>
          ↑
        </OutlineButton>
        <OutlineButton aria-label={`${dayLabel(day)} 아래로`} disabled={busy || last} onClick={() => onMove("down")}>
          ↓
        </OutlineButton>
        <OutlineButton
          onClick={() => {
            setDayNumber(String(day.dayNumber));
            setTitle(day.title ?? "");
            setEditing(true);
          }}
        >
          고치기
        </OutlineButton>
        <ConfirmButton
          disabled={busy}
          confirmLabel={day.wordCount > 0 ? `단어 ${day.wordCount}개도 삭제` : "정말 삭제"}
          onConfirm={onDelete}
        />
      </div>
    </li>
  );
}
