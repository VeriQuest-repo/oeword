// 단어 직접 입력·수정 API (#5). 읽기는 구성원을 고른 누구나, 쓰기는 관리 권한이 있어야 합니다.
//
//   GET    /api/days/:dayId/words   Day 의 단어 목록 (품사별 뜻 포함)
//   POST   /api/days/:dayId/words   단어 추가 { text, senses: [{ pos, meanings: [] }] }
//                                    같은 Day 에 같은 단어가 있으면 기존 단어에 뜻을 합칩니다 → { word, merged: true } (#35)
//   PUT    /api/words/:wordId       단어 고치기 (같은 모양). 같은 Day 의 다른 단어와 철자가 같아지면 409
//   DELETE /api/words/:wordId       단어 삭제
//   POST   /api/days/:dayId/words/bulk  여러 단어 한 번에 넣기 { words: [{ text, senses }] } (#6)
//                                        같은 단어끼리, 그리고 Day 에 이미 있는 단어와는 합칩니다 (#35)
import { PASTE_MAX_WORDS } from "../../src/lib/paste";
import {
  checkWordInput,
  type DayWords,
  flattenSenses,
  groupMeanings,
  mergeSenses,
  wordKey,
  type WordInput,
  type WordView,
} from "../../src/lib/words";
import {
  addWord,
  addWords,
  deleteWord,
  findWordInDay,
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

        // 같은 Day 에 같은 단어가 있으면 새로 만들지 않고 기존 단어에 뜻을 더합니다 (#35).
        const same = await findWordInDay(db, day.id, checked.value.text);
        if (same) {
          const existing = (await listWords(db, day.id)).find((w) => w.id === same.id)!;
          const merged = checkWordInput({
            text: existing.text,
            senses: mergeSenses(groupMeanings(existing.meanings), checked.value.senses),
          });
          if (!merged.ok) return fail(400, "invalid_input", merged.message);
          await updateWord(db, existing.id, { text: existing.text, meanings: flattenSenses(merged.value.senses) });
          return json({ word: { id: existing.id, ...merged.value } satisfies WordView, merged: true });
        }

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
        if (await findWordInDay(db, word.day_id, checked.value.text, word.id)) {
          return fail(409, "duplicate_word", `이 Day에 이미 "${checked.value.text}" 단어가 있어요. 그 단어를 고쳐 주세요.`);
        }

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
  {
    pattern: "/api/days/:dayId/words/bulk",
    methods: {
      async POST(request, db, now, { dayId }) {
        const actor = await requireActor(request, db, now, { manage: true });
        if (actor instanceof Response) return actor;
        const body = await readJson(request);
        const list = (body as { words?: unknown } | undefined)?.words;
        if (!Array.isArray(list) || list.length === 0) {
          return fail(400, "invalid_input", "넣을 단어가 없어요.");
        }
        if (list.length > PASTE_MAX_WORDS) {
          return fail(400, "invalid_input", `한 번에 ${PASTE_MAX_WORDS}단어까지 넣을 수 있어요.`);
        }
        const words: WordInput[] = [];
        for (const [index, item] of list.entries()) {
          const checked = checkWordInput(item);
          if (!checked.ok) return fail(400, "invalid_input", `${index + 1}번째 단어: ${checked.message}`);
          words.push(checked.value);
        }
        const day = await getDayRow(db, actor.familyId, dayId!);
        if (!day) return DAY_NOT_FOUND();

        // 같은 단어끼리 먼저 합치고, Day 에 이미 있는 단어는 그 단어에 뜻을 더합니다 (#35).
        const incoming = new Map<string, WordInput>();
        for (const w of words) {
          const key = wordKey(w.text);
          const before = incoming.get(key);
          incoming.set(key, before ? { text: before.text, senses: mergeSenses(before.senses, w.senses) } : w);
        }
        const existingByKey = new Map((await listWords(db, day.id)).map((w) => [wordKey(w.text), w]));
        const adds: { text: string; meanings: ReturnType<typeof flattenSenses> }[] = [];
        const updates: { wordId: number; text: string; meanings: ReturnType<typeof flattenSenses> }[] = [];
        for (const w of incoming.values()) {
          const existing = existingByKey.get(wordKey(w.text));
          const checked = checkWordInput(
            existing
              ? { text: existing.text, senses: mergeSenses(groupMeanings(existing.meanings), w.senses) }
              : w,
          );
          if (!checked.ok) return fail(400, "invalid_input", `"${w.text}": ${checked.message}`);
          const meanings = flattenSenses(checked.value.senses);
          if (existing) updates.push({ wordId: existing.id, text: existing.text, meanings });
          else adds.push({ text: checked.value.text, meanings });
        }
        await addWords(db, day.id, adds, updates);
        return json(await dayWords(db, actor.familyId, day.id), { status: 201 });
      },
    },
  },
];

export function handleWordApi(request: Request, db: D1Database, now: Date = new Date()): Promise<Response | null> {
  return dispatch(WORD_ROUTES, request, db, now);
}
