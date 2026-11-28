import { useState } from "react";
import { Logo, SubtleButton } from "../components/ui";
import { api } from "../api";
import type { MenuKey } from "../lib/permissions";
import type { SessionResponse } from "../lib/session";
import BooksPage from "./books/BooksPage";
import StudyPage from "./study/StudyPage";
import TestPage from "./test/TestPage";

type Ready = Extract<SessionResponse, { state: "ready" }>;

// 메뉴가 있는 화면. 단어장(#4~#6)·외우기(#7)·시험(#10) 외의 메뉴 화면은 다음 이슈에서 만듭니다.
export default function MainPage({
  session,
  onChange,
}: {
  session: Ready;
  onChange: (session: SessionResponse) => void;
}) {
  const [current, setCurrent] = useState<MenuKey>("home");
  const item = session.menu.find((m) => m.key === current) ?? session.menu[0];

  async function switchMember() {
    onChange(await api.chooseMember(null).catch(() => session));
  }

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo className="text-2xl" />
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate text-base font-medium text-slate-700">{session.member.name}</span>
            <SubtleButton onClick={switchMember} className="shrink-0">
              구성원 바꾸기
            </SubtleButton>
          </div>
        </div>
        <nav aria-label="메뉴" className="mx-auto max-w-6xl overflow-x-auto px-2 sm:px-4">
          <ul className="flex gap-1">
            {session.menu.map((m) => (
              <li key={m.key}>
                <button
                  type="button"
                  aria-current={m.key === item?.key ? "page" : undefined}
                  onClick={() => setCurrent(m.key)}
                  className={`min-h-12 whitespace-nowrap border-b-2 px-4 text-base font-medium ${
                    m.key === item?.key
                      ? "border-indigo-600 text-indigo-700"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {m.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {item?.key === "home" ? (
          <section>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">안녕하세요, {session.member.name}님</h1>
            <p className="mt-2 text-base text-slate-500">{session.family.name}</p>
            <p className="mt-6 rounded-2xl bg-white p-5 text-base text-slate-600 ring-1 ring-slate-200">
              오늘 할 일과 다음 학원 범위는 곧 여기에 보여요.
            </p>
          </section>
        ) : item?.key === "study" ? (
          <StudyPage member={session.member} members={session.members} />
        ) : item?.key === "test" ? (
          <TestPage member={session.member} />
        ) : item?.key === "books" && session.canManage ? (
          <BooksPage />
        ) : (
          <section>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{item?.label}</h1>
            <p className="mt-6 rounded-2xl bg-white p-5 text-base text-slate-600 ring-1 ring-slate-200">
              준비 중이에요.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
