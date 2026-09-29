"use client";

import { useState, useTransition } from "react";
import { requestStaffCode, verifyStaffCode } from "./actions";

const input =
  "h-12 w-full rounded-xl border border-line bg-card px-4 text-base outline-none focus:border-ink disabled:bg-bg disabled:text-muted";
const button =
  "h-12 w-full rounded-xl bg-accent px-5 font-medium text-white transition hover:opacity-90 disabled:opacity-50";

export function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onRequest(e: React.SyntheticEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await requestStaffCode(email);
      if (res.ok) {
        setCode("");
        setStep("code");
      } else setError(res.error);
    });
  }

  function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await verifyStaffCode({ email, code });
      if (res && !res.ok) setError(res.error);
    });
  }

  const errorBox = error && (
    <p role="alert" className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
      {error}
    </p>
  );

  if (step === "code") {
    return (
      <form onSubmit={onVerify} className="space-y-4 rounded-2xl border border-line bg-card p-5">
        <div>
          <p className="text-sm text-muted">Код отправлен на</p>
          <p className="font-medium break-all">{email}</p>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">Код из письма</span>
          <input
            className={`${input} text-center text-xl tracking-[0.4em]`}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
            required
          />
        </label>
        {errorBox}
        <button className={button} disabled={pending || code.length !== 6}>
          {pending ? "Проверяем…" : "Войти"}
        </button>
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <button type="button" className="text-muted underline" onClick={() => setStep("email")}>
            Изменить email
          </button>
          <button type="button" className="text-accent underline" disabled={pending} onClick={onRequest}>
            Отправить код ещё раз
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onRequest} className="space-y-4 rounded-2xl border border-line bg-card p-5">
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">Рабочий email</span>
        <input
          className={input}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@company.ru"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
        />
      </label>
      {errorBox}
      <button className={button} disabled={pending || !email}>
        {pending ? "Отправляем…" : "Получить код"}
      </button>
    </form>
  );
}
