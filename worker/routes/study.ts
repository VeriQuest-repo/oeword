// 외우기 완료 기록 API (#44)
//   POST /api/study/completions                   완료 한 번 남기기 { stage, direction, dayIds, wordCount } (학생 본인만)
//   GET  /api/books/:bookId/study-records?studentId=  Day 별·단계별 완료 횟수
//        학생은 자기 기록만, 보호자(또는 관리 권한)는 가족의 아이 기록을 봅니다.
import { checkCompletionInput, EMPTY_COUNTS, type StudyRecords } from "../../src/lib/study";
import { getMember } from "../db/family";
import { addStudyCompletion, countStudyCompletions, familyDayIds } from "../db/study";
import { getBookRow } from "../db/book";
import { dispatch, fail, json, readJson, requireActor, type Route } from "./http";

export const STUDY_ROUTES: Route[] = [
  {
    pattern: "/api/study/completions",
    methods: {
      async POST(request, db, now) {
        const actor = await requireActor(request, db, now);
        if (actor instanceof Response) return actor;
        if (actor.member.role !== "student") {
          return fail(403, "students_only", "외우기 기록은 학생만 남겨요.");
        }
        const input = checkCompletionInput(await readJson(request));
        if (!input.ok) return fail(400, "invalid_input", input.message);
        const dayIds = await familyDayIds(db, actor.familyId, input.value.dayIds);
        if (dayIds.length !== input.value.dayIds.length) return fail(404, "day_not_found", "Day를 찾지 못했어요.");
        const id = await addStudyCompletion(db, {
          studentId: actor.member.id,
          ...input.value,
          dayIds,
          completedAt: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
        });
        return json({ id }, { status: 201 });
      },
    },
  },
  {
    pattern: "/api/books/:bookId/study-records",
    methods: {
      async GET(request, db, now, { bookId }) {
        const actor = await requireActor(request, db, now);
        if (actor instanceof Response) return actor;
        const raw = new URL(request.url).searchParams.get("studentId");
        const studentId = raw === null ? actor.member.id : Number(raw);
        if (!Number.isSafeInteger(studentId) || studentId < 1) {
          return fail(400, "invalid_input", "학생을 알 수 없어요.");
        }
        if (studentId !== actor.member.id && actor.member.role !== "guardian" && !actor.canManage) {
          return fail(403, "no_permission", "다른 사람의 기록은 볼 수 없어요.");
        }
        const student = await getMember(db, actor.familyId, studentId);
        if (!student || student.role !== "student") return fail(404, "student_not_found", "학생을 찾지 못했어요.");
        if (!(await getBookRow(db, actor.familyId, bookId!))) {
          return fail(404, "book_not_found", "단어장을 찾지 못했어요.");
        }
        const rows = await countStudyCompletions(db, actor.familyId, studentId, bookId!);
        const byDay = new Map<number, StudyRecords["days"][number]>();
        for (const row of rows) {
          const day = byDay.get(row.day_id) ?? { dayId: row.day_id, ...EMPTY_COUNTS };
          day[row.stage] = row.count;
          byDay.set(row.day_id, day);
        }
        const body: StudyRecords = { studentId, days: [...byDay.values()] };
        return json(body);
      },
    },
  },
];

export function handleStudyApi(request: Request, db: D1Database, now: Date = new Date()): Promise<Response | null> {
  return dispatch(STUDY_ROUTES, request, db, now);
}
