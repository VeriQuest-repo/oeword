// 단어 직접 입력·수정 API (#5). 읽기는 구성원을 고른 누구나, 쓰기는 관리 권한이 있어야 합니다.
//
//   GET    /api/days/:dayId/words   Day 의 단어 목록 (품사별 뜻 포함)
//   POST   /api/days/:dayId/words   단어 추가 { text, senses: [{ pos, meanings: [] }] }
//   PUT    /api/words/:wordId       단어 고치기 (같은 모양)
//   DELETE /api/words/:wordId       단어 삭제
import { checkWordInput, type DayWords, flattenSenses, groupMeanings, type WordView } from "../../src/lib/words";
import {
  addWord,
  deleteWord,
  getDayRow,
  getWordRow,
  listWords,
  nextWordSortOrder,
  updateWord,
} from "../db/book";
import type { WordWithMeanings } from "../db/types";
import { dispatch, fail, json, readJson, requireActor, type Route } from "./http";

export function wordView(word: WordWithMeanings): WordView {
  return { id: word.id, text: word.text, senses: groupMeanings(word.meanings) };
}

const DAY_NOT_FOUND = () => fail(404, "day_not_found", "Day를 찾지 못했어요.");
const WORD_NOT_FOUND = () => fail(404, "word_not_found", "단어를 찾지 못했어요.");

/** Day 와 단어 목록. 다른 가족의 Day 면 null. */
export async function dayWords(db: D1Database, familyId: number, dayId: number): Promise<DayWords | null> {
  const day = await getDayRow(db, familyId, dayId);
  if (!day) return null;
  const words = await listWords(db, day.id);
  return {
    day: { id: day.id, bookId: day.book_id, bookTitle: day.book_title, dayNumber: day.day_number, title: day.title },
    words: words.map(wordView),
  };
}

export const WORD_ROUTES: Route[] = [
  {
    pattern: "/api/days/:dayId/words",
    methods: {
      async GET(request, db, now, { dayId }) {
        const actor = await requireActor(request, db, now);
        if (actor instanceof Response) return actor;
        const result = await dayWords(db, actor.familyId, dayId!);
        return result ? json(result) : DAY_NOT_FOUND();
      },
      async POST(request, db, now, { dayId }) {
        const actor = await requireActor(request, db, now, { manage: true });
        if (actor instanceof Response) return actor;
        const checked = checkWordInput(await readJson(request));
        if (!checked.ok) return fail(400, "invalid_input", checked.message);
        const day = await getDayRow(db, actor.familyId, dayId!);
        if (!day) return DAY_NOT_FOUND();

        const word = await addWord(db, {
          dayId: day.id,
          text: checked.value.text,
          meanings: flattenSenses(checked.value.senses),
          sortOrder: await nextWordSortOrder(db, day.id),
        });
        return json({ word: wordView(word) }, { status: 201 });
      },
    },
  },
  {
    pattern: "/api/words/:wordId",
    methods: {
      async PUT(request, db, now, { wordId }) {
        const actor = await requireActor(request, db, now, { manage: true });
        if (actor instanceof Response) return actor;
        const checked = checkWordInput(await readJson(request));
        if (!checked.ok) return fail(400, "invalid_input", checked.message);
        const word = await getWordRow(db, actor.familyId, wordId!);
        if (!word) return WORD_NOT_FOUND();

        await updateWord(db, word.id, { text: checked.value.text, meanings: flattenSenses(checked.value.senses) });
        return json({ word: { id: word.id, ...checked.value } satisfies WordView });
      },
      async DELETE(request, db, now, { wordId }) {
        const actor = await requireActor(request, db, now, { manage: true });
        if (actor instanceof Response) return actor;
        const word = await getWordRow(db, actor.familyId, wordId!);
        if (!word) return WORD_NOT_FOUND();
        await deleteWord(db, word.id);
        return json({ ok: true });
      },
    },
  },
];

export function handleWordApi(request: Request, db: D1Database, now: Date = new Date()): Promise<Response | null> {
  return dispatch(WORD_ROUTES, request, db, now);
}
