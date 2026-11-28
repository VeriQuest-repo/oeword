// 화면 시험 API (#10, #11)
//   POST /api/tests              다 푼 시험을 보내 한꺼번에 채점합니다. 학생이면 시험·문항·단어별 기록을 저장합니다.
//                                보호자가 본 시험은 채점만 하고 저장하지 않습니다 (외우기와 같은 방식).
//   GET  /api/tests?studentId=   지난 시험 목록 (최근 것부터)
//   GET  /api/tests/:testId      시험 한 개의 결과 (내 답과 단어장 뜻)
//   GET  /api/review-words?studentId=  다시 볼 단어 (#12): 틀린 단어 + 오래 안 본 단어
//   학생은 자기 시험만, 보호자(또는 관리 권한)는 가족의 아이 시험을 봅니다.
import { buildDeck, type StudyCard } from "../../src/lib/study";
import {
  checkSubmitInput,
  dayLabels,
  decodeAnswer,
  encodeAnswer,
  gradeItem,
  isoSeconds,
  type ItemAnswer,
  type ItemDirection,
  type TestDetail,
  type TestItemResult,
  type TestSummary,
} from "../../src/lib/test";
import { type DayWords, wordKey } from "../../src/lib/words";
import { listWordsInDays } from "../db/book";
import { getMember, getSettings } from "../db/family";
import { createTest, getTest, listTestDays, listTestItems, listTests, listWordStats, type TestRow } from "../db/test";
import { pickReviewWords, type ReviewCard, type ReviewWords } from "../../src/lib/review";
import { dispatch, fail, json, readJson, requireActor, type Route } from "./http";
import { wordView } from "./words";

/** 시험 범위: Day 들의 단어를 합친 카드와, 단어 id → 카드 찾기 */
export interface TestScope {
  dayIds: number[];
  dayLabels: string[];
  cardOf: (wordId: number) => StudyCard | undefined;
}

/** 가족 안의 Day 들로 시험 범위를 만듭니다. 없는(다른 가족의) Day 가 있으면 null. */
export async function loadScope(db: D1Database, familyId: number, dayIds: number[]): Promise<TestScope | null> {
  const found = await listWordsInDays(db, familyId, dayIds);
  if (found.days.length !== new Set(dayIds).size) return null;
  const days: DayWords[] = found.days.map((d) => ({
    day: { id: d.id, bookId: d.book_id, bookTitle: d.book_title, dayNumber: d.day_number, title: d.title },
    words: found.words.filter((w) => w.day_id === d.id).map(wordView),
  }));
  const deck = buildDeck(days);
  const byKey = new Map(deck.map((c) => [c.key, c]));
  const keyOf = new Map<number, string>();
  for (const d of days) for (const w of d.words) keyOf.set(w.id, wordKey(w.text));
  // oxlint-disable-next-line unicorn/no-array-sort
  const sorted = [...days].sort((a, b) => a.day.dayNumber - b.day.dayNumber);
  return {
    dayIds: sorted.map((d) => d.day.id),
    dayLabels: dayLabels(sorted.map((d) => d.day)),
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
      async GET(request, db, now) {
        const actor = await requireActor(request, db, now);
        if (actor instanceof Response) return actor;
        const raw = new URL(request.url).searchParams.get("studentId");
        const studentId = raw === null ? actor.member.id : Number(raw);
        const denied = await checkStudent(db, actor, studentId);
        if (denied) return denied;
        const rows = await listTests(db, actor.familyId, studentId);
        const days = await listTestDays(
          db,
          rows.map((r) => r.id),
        );
        const tests: TestSummary[] = rows.map((r) => ({
          ...summaryOf(r),
          dayLabels: dayLabels(
            days
              .filter((d) => d.test_id === r.id)
              .map((d) => ({ dayNumber: d.day_number, bookId: d.book_id, bookTitle: d.book_title })),
          ),
        }));
        return json({ studentId, tests });
      },
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
  {
    pattern: "/api/tests/:testId",
    methods: {
      async GET(request, db, now, { testId }) {
        const actor = await requireActor(request, db, now);
        if (actor instanceof Response) return actor;
        const test = await getTest(db, actor.familyId, testId!);
        if (!test) return fail(404, "test_not_found", "시험을 찾지 못했어요.");
        const denied = await checkStudent(db, actor, test.student_id);
        if (denied) return denied;
        const dayRows = await listTestDays(db, [test.id]);
        const scope = await loadScope(
          db,
          actor.familyId,
          dayRows.map((d) => d.day_id),
        );
        if (!scope) return fail(404, "day_not_found", "Day를 찾지 못했어요.");
        const items: TestItemResult[] = [];
        for (const row of await listTestItems(db, test.id)) {
          const card = scope.cardOf(row.word_id);
          if (!card) continue; // 그 뒤 단어를 다른 Day 로 옮긴 경우 등
          const answer = decodeAnswer(row.direction, row.answer);
          items.push(
            itemResult(
              card,
              { position: row.position, wordId: row.word_id, direction: row.direction, answer },
              row.is_correct === null ? undefined : row.is_correct === 1,
            ),
          );
        }
        const body: TestDetail = {
          id: test.id,
          testNumber: test.test_number,
          studentId: test.student_id,
          mode: test.mode,
          direction: test.direction,
          firstLetterHint: test.first_letter_hint === 1,
          createdAt: test.created_at,
          finishedAt: test.finished_at,
          dayIds: scope.dayIds,
          dayLabels: scope.dayLabels,
          correctCount: test.correct_count,
          total: test.total,
          items,
        };
        return json(body);
      },
    },
  },
  {
    pattern: "/api/review-words",
    methods: {
      async GET(request, db, now) {
        const actor = await requireActor(request, db, now);
        if (actor instanceof Response) return actor;
        const raw = new URL(request.url).searchParams.get("studentId");
        const studentId = raw === null ? actor.member.id : Number(raw);
        const denied = await checkStudent(db, actor, studentId);
        if (denied) return denied;
        const limit = (await getSettings(db, actor.familyId))?.question_count ?? 30;
        const rows = await listWordStats(db, actor.familyId, studentId);
        let picks = pickReviewWords(
          rows.map((r) => ({
            wordId: r.word_id,
            key: wordKey(r.text),
            dayId: r.day_id,
            wrongCount: r.wrong_count,
            lastCorrect: r.last_correct === 1,
            lastSeenAt: r.last_seen_at!,
          })),
          now,
          limit,
        );
        // 시험 범위(Day)는 100개까지 보낼 수 있어, 그 안에 드는 단어만 냅니다.
        const dayIds: number[] = [];
        picks = picks.filter((p) => {
          const extra = p.dayIds.filter((id) => !dayIds.includes(id));
          if (dayIds.length + extra.length > 100) return false;
          dayIds.push(...extra);
          return true;
        });
        const scope = await loadScope(db, actor.familyId, dayIds);
        const words: ReviewCard[] = [];
        for (const pick of picks) {
          const card = scope?.cardOf(pick.wordIds[0]!);
          if (card) words.push({ ...card, reason: pick.reason, lastSeenAt: pick.lastSeenAt });
        }
        const body: ReviewWords = {
          studentId,
          wrongCount: words.filter((w) => w.reason === "wrong").length,
          oldCount: words.filter((w) => w.reason === "old").length,
          dayIds: scope?.dayIds ?? [],
          words,
        };
        return json(body);
      },
    },
  },
];

function summaryOf(row: TestRow): Omit<TestSummary, "dayLabels"> {
  return {
    id: row.id,
    testNumber: row.test_number,
    mode: row.mode,
    direction: row.direction,
    medium: row.medium,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    correctCount: row.correct_count,
    total: row.total,
  };
}

/** 이 학생의 시험을 볼 수 있는지. 학생은 자기 것만, 보호자(또는 관리 권한)는 가족의 아이 것을 봅니다. */
async function checkStudent(
  db: D1Database,
  actor: { familyId: number; member: { id: number; role: string }; canManage: boolean },
  studentId: number,
): Promise<Response | null> {
  if (!Number.isSafeInteger(studentId) || studentId < 1) return fail(400, "invalid_input", "학생을 알 수 없어요.");
  if (studentId !== actor.member.id && actor.member.role !== "guardian" && !actor.canManage) {
    return fail(403, "no_permission", "다른 사람의 시험은 볼 수 없어요.");
  }
  const student = await getMember(db, actor.familyId, studentId);
  if (!student || student.role !== "student") return fail(404, "student_not_found", "학생을 찾지 못했어요.");
  return null;
}

export function handleTestApi(request: Request, db: D1Database, now: Date = new Date()): Promise<Response | null> {
  return dispatch(TEST_ROUTES, request, db, now);
}
