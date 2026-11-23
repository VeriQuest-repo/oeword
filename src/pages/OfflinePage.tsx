import { useEffect, useState } from "react";
import StatusBadge from "../components/StatusBadge";
import { Logo, PrimaryButton } from "../components/ui";
import { type ServerStatus, toServerStatus } from "../lib/health";

// 처음 상태(/api/session)를 못 불러왔을 때. 서버·데이터베이스 중 어디가 문제인지 보여 줍니다.
export default function OfflinePage({ onRetry }: { onRetry: () => void }) {
  const [status, setStatus] = useState<ServerStatus>("checking");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: unknown) => {
        if (!cancelled) setStatus(toServerStatus(body));
      })
      .catch(() => {
        if (!cancelled) setStatus("offline");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-slate-50 px-6 text-center">
      <Logo className="text-5xl" />
      <p className="text-lg text-slate-600">외워드를 불러오지 못했어요.</p>
      <StatusBadge status={status} />
      <PrimaryButton onClick={onRetry}>다시 시도</PrimaryButton>
    </main>
  );
}
