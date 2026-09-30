"use client";

import { useRef, useState, useTransition } from "react";

export type ActionResult = { error?: string; message?: string } | void;

/**
 * Форма, которая вызывает серверное действие и показывает ошибку, не стирая введённое.
 * Нажатая кнопка (name/value) передаётся в действие — так работают кнопки «Сохранить черновик» / «Открыть приём».
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  confirmText,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirmText?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (confirmText && !window.confirm(confirmText)) return;
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    setError(null);
    setMessage(null);
    start(async () => {
      const res = await action(fd);
      if (res?.error) setError(res.error);
      else {
        if (res?.message) setMessage(res.message);
        if (resetOnSuccess) ref.current?.reset();
      }
    });
  }

  return (
    <form ref={ref} onSubmit={onSubmit} className={className}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {error && (
        <p role="alert" className="mt-3 rounded-[10px] bg-accent-soft px-4 py-3 text-sm text-accent">
          {error}
        </p>
      )}
      {message && <p className="mt-3 rounded-[10px] bg-open-bg px-4 py-3 text-sm text-open">{message}</p>}
      {pending && <p className="mt-3 text-sm text-muted">Сохраняем…</p>}
    </form>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
