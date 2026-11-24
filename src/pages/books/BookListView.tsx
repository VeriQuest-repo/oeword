import { type FormEvent, useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../../api";
import { ErrorText, inputClass, Panel, PrimaryButton } from "../../components/ui";
import { BOOK_TITLE_MAX_LENGTH, type BookSummary, checkBookTitle } from "../../lib/books";

// 단어장 목록과 새 단어장 만들기. 보관한 단어장은 "보관한 단어장 보기"를 켜야 보입니다.
export default function BookListView({ onOpen }: { onOpen: (bookId: number) => void }) {
  const [books, setBooks] = useState<BookSummary[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .books(showArchived)
      .then((r) => setBooks(r.books))
      .catch((e) => setError(errorMessage(e)));
  }, [showArchived]);

  useEffect(load, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    const checked = checkBookTitle(title);
    if (!checked.ok) return setError(checked.message);
    setBusy(true);
    setError(null);
    try {
      const created = await api.createBook(checked.value);
      setTitle("");
      onOpen(created.book.id);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const active = books?.filter((b) => !b.archived) ?? [];
  const archived = books?.filter((b) => b.archived) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">단어장</h1>

      <Panel>
        <form onSubmit={create} className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="new-book-title">
            새 단어장 이름
          </label>
          <input
            id="new-book-title"
            className={inputClass}
            placeholder="새 단어장 이름 (예: 중등 영단어 1권)"
            maxLength={BOOK_TITLE_MAX_LENGTH}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <PrimaryButton type="submit" disabled={busy} className="shrink-0">
            단어장 만들기
          </PrimaryButton>
        </form>
      </Panel>

      <ErrorText message={error} />

      {books === null ? (
        <p className="text-base text-slate-400">불러오는 중…</p>
      ) : active.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-base text-slate-600 ring-1 ring-slate-200">
          아직 단어장이 없어요. 위에서 첫 단어장을 만들어 주세요.
        </p>
      ) : (
        <BookGrid books={active} onOpen={onOpen} />
      )}

      <label className="flex min-h-12 w-fit cursor-pointer items-center gap-3 text-base text-slate-600">
        <input
          type="checkbox"
          className="size-5 accent-indigo-600"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        보관한 단어장 보기
      </label>

      {showArchived &&
        (archived.length === 0 ? (
          <p className="text-base text-slate-500">보관한 단어장이 없어요.</p>
        ) : (
          <BookGrid books={archived} onOpen={onOpen} />
        ))}
    </div>
  );
}

function BookGrid({ books, onOpen }: { books: BookSummary[]; onOpen: (bookId: number) => void }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {books.map((book) => (
        <li key={book.id}>
          <button
            type="button"
            onClick={() => onOpen(book.id)}
            className={`block min-h-24 w-full rounded-3xl p-5 text-left ring-1 hover:ring-indigo-400 ${
              book.archived ? "bg-slate-100 ring-slate-200" : "bg-white ring-slate-200"
            }`}
          >
            <span className="block break-words text-lg font-semibold text-slate-900">{book.title}</span>
            <span className="mt-1 block text-base text-slate-500">
              {book.archived && <span className="mr-2 rounded-md bg-slate-200 px-2 py-0.5 text-sm">보관됨</span>}
              Day {book.dayCount}개 · 단어 {book.wordCount}개
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
