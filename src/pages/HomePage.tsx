import { useEffect, useState } from "react";
import StatusBadge from "../components/StatusBadge";
import { type ServerStatus, toServerStatus } from "../lib/health";

export default function HomePage() {
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
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-slate-50 px-6 py-10 text-center">
      <h1 className="text-5xl font-bold tracking-tight text-indigo-600 sm:text-6xl">외워드</h1>
      <p className="max-w-md text-lg leading-relaxed text-slate-600">
        단어장을 한 번 입력하면, 직접 떠올려 답하며 외우는 가족용 영단어 서비스
      </p>
      <StatusBadge status={status} />
      <p className="text-sm text-slate-400">지금은 준비 중이에요.</p>
    </main>
  );
}
