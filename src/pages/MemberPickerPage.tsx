import { useState } from "react";
import { ErrorText, Logo, SubtleButton } from "../components/ui";
import { api, ApiRequestError } from "../api";
import type { MemberSummary, SessionResponse } from "../lib/session";

type Choose = Extract<SessionResponse, { state: "choose" }>;

const ROLE_LABEL = { guardian: "보호자", student: "학생" } as const;

// "누가 쓰나요?" 패드 가로(1180px)에서 한 줄에 4명, 세로·폰에서는 2~3명씩 보입니다.
export default function MemberPickerPage({
  session,
  onChange,
}: {
  session: Choose;
  onChange: (session: SessionResponse) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function run(action: () => Promise<SessionResponse>, id: number | null = null) {
    setBusyId(id);
    setError(null);
    try {
      onChange(await action());
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "잠시 문제가 생겼어요. 다시 해 주세요.");
      setBusyId(null);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-slate-50 px-4 py-6 sm:px-8">
      <header className="flex items-center justify-between gap-3">
        <Logo className="text-2xl" />
        <SubtleButton onClick={() => run(api.logout)}>로그아웃</SubtleButton>
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center py-8">
        <p className="mb-1 text-center text-base text-slate-500">{session.family.name}</p>
        <h1 className="mb-8 text-center text-3xl font-bold text-slate-900 sm:text-4xl">누가 쓰나요?</h1>
        <ErrorText message={error} />
        {session.members.length === 0 ? (
          <p className="text-center text-slate-500">구성원이 없어요.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
            {session.members.map((member) => (
              <li key={member.id}>
                <MemberCard
                  member={member}
                  busy={busyId === member.id}
                  disabled={busyId !== null}
                  onPick={() => run(() => api.chooseMember(member.id), member.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function MemberCard({
  member,
  busy,
  disabled,
  onPick,
}: {
  member: MemberSummary;
  busy: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  const student = member.role === "student";
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      className="flex w-full flex-col items-center gap-3 rounded-3xl bg-white px-3 py-6 shadow-sm ring-1 ring-slate-200 hover:ring-2 hover:ring-indigo-400 disabled:opacity-60 sm:py-8"
    >
      <span
        aria-hidden
        className={`flex size-16 items-center justify-center rounded-full text-2xl font-bold sm:size-20 sm:text-3xl ${
          student ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"
        }`}
      >
        {Array.from(member.name)[0]}
      </span>
      <span className="w-full truncate text-xl font-semibold text-slate-900">{member.name}</span>
      <span className="text-sm text-slate-500">{busy ? "들어가는 중…" : ROLE_LABEL[member.role]}</span>
    </button>
  );
}
