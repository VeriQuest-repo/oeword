import { type FormEvent, useState } from "react";
import { CenteredCard, ErrorText, PrimaryButton, SubtleButton, TextField } from "../components/ui";
import { api, ApiRequestError } from "../api";
import type { MemberRole } from "../lib/permissions";
import {
  checkSetupInput,
  MEMBER_MAX_COUNT,
  NAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type SessionResponse,
} from "../lib/session";

interface Row {
  key: number;
  name: string;
  role: MemberRole;
}

const ROLE_LABEL: Record<MemberRole, string> = { guardian: "보호자", student: "학생" };

// 처음 한 번만 보이는 화면: 가족 이름, 가족 비밀번호, 구성원을 정합니다.
export default function SetupPage({ onDone }: { onDone: (session: SessionResponse) => void }) {
  const [familyName, setFamilyName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [rows, setRows] = useState<Row[]>([
    { key: 1, name: "", role: "guardian" },
    { key: 2, name: "", role: "student" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (key: number, change: Partial<Row>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...change } : r)));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const input = { familyName, password, members: rows.map(({ name, role }) => ({ name, role })) };
    const checked = checkSetupInput(input);
    if (!checked.ok) return setError(checked.message);
    if (password !== confirm) return setError("비밀번호 확인이 맞지 않아요.");

    setBusy(true);
    setError(null);
    try {
      onDone(await api.setup(checked.input));
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "잠시 문제가 생겼어요. 다시 해 주세요.");
      setBusy(false);
    }
  }

  return (
    <CenteredCard title="처음 설정">
      <form onSubmit={submit} className="space-y-6">
        <p className="text-base leading-relaxed text-slate-600">
          가족이 함께 쓸 이름과 비밀번호를 정해 주세요. 이 비밀번호 하나로 PC·패드·폰 어디서나 들어올 수 있어요.
        </p>
        <TextField
          label="가족 이름"
          placeholder="예: 우리 가족"
          maxLength={NAME_MAX_LENGTH}
          value={familyName}
          onChange={(e) => setFamilyName(e.target.value)}
        />
        <TextField
          label="가족 비밀번호"
          type="password"
          autoComplete="new-password"
          hint={`${PASSWORD_MIN_LENGTH}자 이상`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <TextField
          label="가족 비밀번호 확인"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <fieldset className="min-w-0">
          <legend className="mb-2 text-base font-medium text-slate-700">구성원</legend>
          <ul className="space-y-3">
            {rows.map((row, index) => (
              <li key={row.key} className="flex flex-wrap items-center gap-2">
                <input
                  aria-label={`구성원 ${index + 1} 이름`}
                  placeholder="이름"
                  maxLength={NAME_MAX_LENGTH}
                  value={row.name}
                  onChange={(e) => update(row.key, { name: e.target.value })}
                  className="min-h-14 min-w-0 flex-1 basis-40 rounded-2xl border border-slate-300 px-4 text-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                />
                <div role="radiogroup" aria-label={`구성원 ${index + 1} 역할`} className="flex gap-1 rounded-2xl bg-slate-100 p-1">
                  {(["guardian", "student"] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      role="radio"
                      aria-checked={row.role === role}
                      onClick={() => update(row.key, { role })}
                      className={`min-h-12 rounded-xl px-4 text-base font-medium ${
                        row.role === role ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"
                      }`}
                    >
                      {ROLE_LABEL[role]}
                    </button>
                  ))}
                </div>
                {rows.length > 1 && (
                  <SubtleButton
                    type="button"
                    aria-label={`구성원 ${index + 1} 빼기`}
                    onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}
                  >
                    빼기
                  </SubtleButton>
                )}
              </li>
            ))}
          </ul>
          {rows.length < MEMBER_MAX_COUNT && (
            <SubtleButton
              type="button"
              className="mt-3 text-indigo-600"
              onClick={() =>
                setRows((list) => [...list, { key: Math.max(0, ...list.map((r) => r.key)) + 1, name: "", role: "student" }])
              }
            >
              + 구성원 추가
            </SubtleButton>
          )}
          <p className="mt-2 text-sm text-slate-500">보호자를 한 명 이상 넣어 주세요.</p>
        </fieldset>

        <ErrorText message={error} />
        <PrimaryButton type="submit" disabled={busy} className="w-full">
          {busy ? "만드는 중…" : "시작하기"}
        </PrimaryButton>
      </form>
    </CenteredCard>
  );
}
