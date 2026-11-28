// 화면 시험 API (#10)
//   POST /api/tests   다 푼 시험을 보내 한꺼번에 채점합니다. 학생이면 시험·문항을 저장합니다.
//                     보호자가 본 시험은 채점만 하고 저장하지 않습니다 (외우기와 같은 방식).
import { dayLabel } from "../../src/lib/books";
import { buildDeck, type StudyCard } from "../../src/lib/study";
import {
  checkSubmitInput,
  encodeAnswer,
  gradeItem,
  isoSeconds,
  type ItemAnswer,
  type ItemDirection,
  type TestDetail,
  type TestItemResult,
} from "../../src/lib/test";
import { type DayWords, wordKey } from "../../src/lib/words";
import { createTest } from "../db/test";
import { dispatch, fail, json, readJson, requireActor, type Route } from "./http";
import { dayWords } from "./words";

/** 시험 범위: Day 들의 단어를 합친 카드와, 단어 id → 카드 찾기 */
export interface TestScope {
  dayIds: number[];
  dayLabels: string[];
  cardOf: (wordId: number) => StudyCard | undefined;
}

/** 가족 안의 Day 들로 시험 범위를 만듭니다. 없는(다른 가족의) Day 가 있으면 null. */
export async function loadScope(db: D1Database, familyId: number, dayIds: number[]): Promise<TestScope | null> {
  const days: DayWords[] = [];
  for (const id of dayIds) {
    const day = await dayWords(db, familyId, id);
    if (!day) return null;
    days.push(day);
  }
  const deck = buildDeck(days);
  const byKey = new Map(deck.map((c) => [c.key, c]));
  const keyOf = new Map<number, string>();
  for (const d of days) for (const w of d.words) keyOf.set(w.id, wordKey(w.text));
  // oxlint-disable-next-line unicorn/no-array-sort
  const sorted = [...days].sort((a, b) => a.day.dayNumber - b.day.dayNumber);
  const multiBook = new Set(days.map((x) => x.day.bookId)).size > 1;
  const labels = sorted.map((d) => {
    const label = dayLabel({ dayNumber: d.day.dayNumber, title: null });
    return multiBook ? `${d.day.bookTitle} ${label}` : label;
  });
  return {
    dayIds: sorted.map((d) => d.day.id),
    dayLabels: labels,
    cardOf: (wordId) => {
      const key = keyOf.get(wordId);
      return key === undefined ? undefined : byKey.get(key);
    },
  };
}

/** 문항 하나를 채점해 결과 모양으로 만듭니다. */
export function itemResult(
  card: StudyCard,
  item: { position: number; wordId: number; direction: ItemDirection; answer: ItemAnswer },
  storedCorrect?: boolean,
): TestItemResult {
  const graded = gradeItem(card, item.direction, item.answer);
  return {
    position: item.position,
    wordId: item.wordId,
    text: card.text,
    direction: item.direction,
    senses: card.senses,
    days: card.days,
    answer: item.answer,
    // 저장된 시험은 그때 채점한 결과를 그대로 씁니다 (나중에 단어장 뜻이 바뀌어도 점수는 그대로).
    correct: storedCorrect ?? graded.correct,
    senseGrades: graded.senseGrades,
  };
}

export const TEST_ROUTES: Route[] = [
  {
    pattern: "/api/tests",
    methods: {
      async POST(request, db, now) {
        const actor = await requireActor(request, db, now);
        if (actor instanceof Response) return actor;
        const input = checkSubmitInput(await readJson(request), now);
        if (!input.ok) return fail(400, "invalid_input", input.message);
        const { value } = input;

        const scope = await loadScope(db, actor.familyId, value.dayIds);
        if (!scope) return fail(404, "day_not_found", "Day를 찾지 못했어요.");
        const items: TestItemResult[] = [];
        for (const [i, item] of value.items.entries()) {
          const card = scope.cardOf(item.wordId);
          if (!card) {
            return fail(409, "word_changed", "시험 보는 동안 단어장이 바뀌었어요. 시험을 다시 시작해 주세요.");
          }
          items.push(itemResult(card, { position: i + 1, ...item }));
        }

        const finishedAt = isoSeconds(now);
        const student = actor.member.role === "student";
        const saved = student
          ? await createTest(db, {
              studentId: actor.member.id,
              mode: value.mode,
              direction: value.direction,
              firstLetterHint: value.firstLetterHint,
              createdBy: actor.member.id,
              createdAt: value.startedAt,
              finishedAt,
              dayIds: scope.dayIds,
              items: items.map((it) => ({
                wordId: it.wordId,
                direction: it.direction,
                answer: encodeAnswer(it.direction, it.answer),
                isCorrect: it.correct,
              })),
            })
          : null;

        const body: TestDetail = {
          id: saved?.id ?? null,
          testNumber: saved?.testNumber ?? null,
          studentId: student ? actor.member.id : null,
          mode: value.mode,
          direction: value.direction,
          firstLetterHint: value.firstLetterHint,
          createdAt: value.startedAt,
          finishedAt,
          dayIds: scope.dayIds,
          dayLabels: scope.dayLabels,
          correctCount: items.filter((it) => it.correct).length,
          total: items.length,
          items,
        };
        return json(body, { status: saved ? 201 : 200 });
      },
    },
  },
];

export function handleTestApi(request: Request, db: D1Database, now: Date = new Date()): Promise<Response | null> {
  return dispatch(TEST_ROUTES, request, db, now);
}
