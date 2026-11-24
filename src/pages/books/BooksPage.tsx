import { useState } from "react";
import BookListView from "./BookListView";
import BookView from "./BookView";

export type BooksView = { kind: "list" } | { kind: "book"; bookId: number };

// 단어장 메뉴: 단어장 목록 → 단어장 한 권(Day 목록) (#4)
export default function BooksPage() {
  const [view, setView] = useState<BooksView>({ kind: "list" });

  switch (view.kind) {
    case "list":
      return <BookListView onOpen={(bookId) => setView({ kind: "book", bookId })} />;
    case "book":
      return <BookView bookId={view.bookId} onBack={() => setView({ kind: "list" })} />;
  }
}
