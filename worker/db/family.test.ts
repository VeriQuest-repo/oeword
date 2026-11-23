import { describe, expect, it } from "vitest";
import { addMember, createFamily, getFamily, getSettings, listMembers, updateSettings } from "./family";
import { createTestDb } from "./testing/sqlite-d1";

describe("가족·구성원", () => {
  it("가족을 만들면 기본 설정(보호자 관리, 30문제)도 생긴다", async () => {
    const { db } = createTestDb();
    const family = await createFamily(db, "우리 가족");
    expect(await getFamily(db, family.id)).toMatchObject({ id: family.id, name: "우리 가족" });
    expect(await getSettings(db, family.id)).toMatchObject({
      manage_mode: "guardian",
      question_count: 30,
    });
  });

  it("보호자·학생 여러 명을 정한 순서대로 돌려준다", async () => {
    const { db } = createTestDb();
    const { id: familyId } = await createFamily(db, "우리 가족");
    await addMember(db, { familyId, name: "학생2", role: "student", sortOrder: 3 });
    await addMember(db, { familyId, name: "보호자1", role: "guardian", sortOrder: 0 });
    await addMember(db, { familyId, name: "보호자2", role: "guardian", sortOrder: 1 });
    await addMember(db, { familyId, name: "학생1", role: "student", sortOrder: 2 });

    const members = await listMembers(db, familyId);
    expect(members.map((m) => [m.name, m.role])).toEqual([
      ["보호자1", "guardian"],
      ["보호자2", "guardian"],
      ["학생1", "student"],
      ["학생2", "student"],
    ]);
  });

  it("다른 가족의 구성원은 섞이지 않는다", async () => {
    const { db } = createTestDb();
    const a = await createFamily(db, "가족 A");
    const b = await createFamily(db, "가족 B");
    await addMember(db, { familyId: a.id, name: "A학생", role: "student" });
    await addMember(db, { familyId: b.id, name: "B학생", role: "student" });
    expect((await listMembers(db, a.id)).map((m) => m.name)).toEqual(["A학생"]);
  });

  it("설정은 바꾼 항목만 바뀐다", async () => {
    const { db } = createTestDb();
    const { id } = await createFamily(db, "우리 가족");
    await updateSettings(db, id, { questionCount: 50 });
    expect(await getSettings(db, id)).toMatchObject({ manage_mode: "guardian", question_count: 50 });
    await updateSettings(db, id, { manageMode: "self" });
    expect(await getSettings(db, id)).toMatchObject({ manage_mode: "self", question_count: 50 });
  });

  it("없는 가족은 null", async () => {
    const { db } = createTestDb();
    expect(await getFamily(db, 999)).toBeNull();
    expect(await getSettings(db, 999)).toBeNull();
  });
});
