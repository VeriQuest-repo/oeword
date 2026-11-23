// 여러 화면에서 쓰는 작은 부품. 패드·폰에서 손가락·펜슬로 누르기 쉽게 크게 만듭니다.
import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, useId } from "react";

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

export function PrimaryButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
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
