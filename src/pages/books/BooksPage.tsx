import { useState } from "react";
import BookListView from "./BookListView";
import BookView from "./BookView";
import DayView from "./DayView";

export type BooksView = { kind: "list" } | { kind: "book"; bookId: number } | { kind: "day"; dayId: number };

// 단어장 메뉴: 단어장 목록 → 단어장 한 권(Day 목록, #4) → Day 하나(단어, #5)
export default function BooksPage() {
  const [view, setView] = useState<BooksView>({ kind: "list" });

  // 화면이 바뀌면 맨 위부터 보이게 합니다.
  const go = (next: BooksView) => {
    setView(next);
    window.scrollTo({ top: 0 });
  };

  switch (view.kind) {
    case "list":
      return <BookListView onOpen={(bookId) => go({ kind: "book", bookId })} />;
    case "book":
      return (
        <BookView
          bookId={view.bookId}
          onBack={() => go({ kind: "list" })}
          onOpenDay={(day) => go({ kind: "day", dayId: day.id })}
        />
      );
    case "day":
      return (
        <DayView
          dayId={view.dayId}
          onBack={(bookId) => go(bookId === null ? { kind: "list" } : { kind: "book", bookId })}
        />
      );
  }
}
