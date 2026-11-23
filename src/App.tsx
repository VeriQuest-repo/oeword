import { useEffect, useState } from "react";
import { api } from "./api";
import type { SessionResponse } from "./lib/session";
import LoginPage from "./pages/LoginPage";
import MainPage from "./pages/MainPage";
import MemberPickerPage from "./pages/MemberPickerPage";
import OfflinePage from "./pages/OfflinePage";
import SetupPage from "./pages/SetupPage";

// 화면 흐름: 처음 설정 → 가족 비밀번호 → "누가 쓰나요?" → 메뉴가 있는 화면
export default function App() {
  // "다시 시도"를 누르면 key 가 바뀌어 처음부터 다시 불러옵니다.
  const [attempt, setAttempt] = useState(0);
  return <SessionRoot key={attempt} onRetry={() => setAttempt((n) => n + 1)} />;
}

function SessionRoot({ onRetry }: { onRetry: () => void }) {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .session()
      .then((next) => {
        if (!cancelled) setSession(next);
      })
      .catch(() => {
        if (!cancelled) setOffline(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (offline) return <OfflinePage onRetry={onRetry} />;
  if (!session) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-50 text-slate-400">
        불러오는 중…
      </main>
    );
  }

  switch (session.state) {
    case "setup":
      return <SetupPage onDone={setSession} />;
    case "login":
      return <LoginPage onDone={setSession} />;
    case "choose":
      return <MemberPickerPage session={session} onChange={setSession} />;
    case "ready":
      return <MainPage session={session} onChange={setSession} />;
  }
}
