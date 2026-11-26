// 여러 화면에서 쓰는 작은 부품. 패드·폰에서 손가락·펜슬로 누르기 쉽게 크게 만듭니다.
import { type ButtonHTMLAttributes, type ComponentPropsWithRef, type InputHTMLAttributes, type ReactNode, useEffect, useId, useState } from "react";

export function Logo({ className = "" }: { className?: string }) {
  return <span className={`font-bold tracking-tight text-indigo-600 ${className}`}>외워드</span>;
}

/** 가운데 카드 하나로 된 화면 (처음 설정, 로그인). */
export function CenteredCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center bg-slate-50 px-4 py-10 sm:justify-center">
      <Logo className="mb-6 text-4xl sm:text-5xl" />
      <section className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">{title}</h1>
        {children}
      </section>
    </main>
  );
}

export function TextField({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-base font-medium text-slate-700">
        {label}
      </label>
      <input
        {...props}
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="block min-h-14 w-full min-w-0 rounded-2xl border border-slate-300 bg-white px-4 text-lg text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

export function PrimaryButton({ children, className = "", ...props }: ComponentPropsWithRef<"button">) {
  return (
    <button
      {...props}
      className={`min-h-14 rounded-2xl bg-indigo-600 px-6 text-lg font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-300 ${className}`}
    >
      {children}
    </button>
  );
}

export function SubtleButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`min-h-11 rounded-xl px-4 text-base font-medium text-slate-600 hover:bg-slate-100 ${className}`}
    >
      {children}
    </button>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-base text-rose-700">
      {message}
    </p>
  );
}

/** 테두리만 있는 버튼 (보조 동작). */
export function OutlineButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`min-h-12 rounded-2xl border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * 두 번 눌러야 실행되는 삭제 버튼. 처음 누르면 "정말 삭제" 로 바뀌고, 4초 안에 다시 눌러야 지웁니다.
 * (브라우저 확인 창 대신 써서 패드에서도 자연스럽게 확인합니다.)
 */
export function ConfirmButton({
  label = "삭제",
  confirmLabel = "정말 삭제",
  onConfirm,
  className = "",
  disabled,
}: {
  label?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
      className={`min-h-12 rounded-2xl px-4 text-base font-medium disabled:opacity-40 ${
        armed ? "bg-rose-600 text-white hover:bg-rose-700" : "text-rose-600 hover:bg-rose-50"
      } ${className}`}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

/** 화면 위쪽의 "← 돌아가기" 링크 모양 버튼. */
export function BackButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-2 mb-3 min-h-11 rounded-xl px-2 text-base font-medium text-indigo-700 hover:bg-indigo-50"
    >
      ← {children}
    </button>
  );
}

/** 흰 카드 */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-white p-4 ring-1 ring-slate-200 sm:p-6 ${className}`}>{children}</section>;
}

/** 라벨 없이 쓰는 입력칸 (라벨은 aria-label 로). */
export const inputClass =
  "block min-h-14 w-full min-w-0 rounded-2xl border border-slate-300 bg-white px-4 text-lg text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";
