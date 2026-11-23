import { type FormEvent, useState } from "react";
import { CenteredCard, ErrorText, PrimaryButton, TextField } from "../components/ui";
import { api, ApiRequestError } from "../api";
import type { SessionResponse } from "../lib/session";

export default function LoginPage({ onDone }: { onDone: (session: SessionResponse) => void }) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!password) return setError("가족 비밀번호를 적어 주세요.");
    setBusy(true);
    setError(null);
    try {
      onDone(await api.login(password));
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "잠시 문제가 생겼어요. 다시 해 주세요.");
      setBusy(false);
    }
  }

  return (
    <CenteredCard title="가족 비밀번호">
      <form onSubmit={submit} className="space-y-5">
        <TextField
          label="가족 비밀번호"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label className="flex min-h-11 items-center gap-3 text-base text-slate-600">
          <input type="checkbox" className="size-5" checked={show} onChange={(e) => setShow(e.target.checked)} />
          비밀번호 보기
        </label>
        <ErrorText message={error} />
        <PrimaryButton type="submit" disabled={busy} className="w-full">
          {busy ? "확인 중…" : "들어가기"}
        </PrimaryButton>
      </form>
    </CenteredCard>
  );
}
