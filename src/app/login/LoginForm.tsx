"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Building2, Check } from "lucide-react";
import type { CompanyInfo } from "@/lib/dadata";
import { lookupInn, requestCode, verifyCode } from "./actions";

const input =
  "h-12 w-full rounded-xl border border-line bg-card px-4 text-base outline-none focus:border-ink disabled:bg-bg disabled:text-muted";
const button =
  "h-12 w-full rounded-xl bg-accent px-5 font-medium text-white transition hover:opacity-90 disabled:opacity-50";

export function LoginForm() {
  const [inn, setInn] = useState("");
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"inn" | "code">("inn");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onFindInn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await lookupInn(inn);
      if (res.ok) setCompany(res.company);
      else setError(res.error);
    });
  }

  function onRequestCode(e: React.SyntheticEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await requestCode({ inn, email, consent });
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
      // При успехе сервер сам перенаправит на «Объекты».
      const res = await verifyCode({ inn, email, code });
      if (res && !res.ok) setError(res.error);
    });
  }

  function resetInn() {
    setCompany(null);
    setStep("inn");
    setError(null);
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
          <button type="button" className="text-muted underline" onClick={() => setStep("inn")}>
            Изменить email
          </button>
          <button type="button" className="text-accent underline" disabled={pending} onClick={onRequestCode}>
            Отправить код ещё раз
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onFindInn} className="space-y-3 rounded-2xl border border-line bg-card p-5">
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">ИНН компании или ИП</span>
          <input
            className={input}
            inputMode="numeric"
            maxLength={12}
            placeholder="10 или 12 цифр"
            value={inn}
            disabled={!!company}
            onChange={(e) => setInn(e.target.value.replace(/\D/g, ""))}
            autoFocus
            required
          />
        </label>
        {company ? (
          <button type="button" className="text-sm text-muted underline" onClick={resetInn}>
            Изменить ИНН
          </button>
        ) : (
          <>
            {errorBox}
            <button className={button} disabled={pending || !(inn.length === 10 || inn.length === 12)}>
              {pending ? "Ищем…" : "Найти компанию"}
            </button>
          </>
        )}
      </form>

      {company && (
        <form onSubmit={onRequestCode} className="space-y-4">
          <div className="rounded-2xl border border-line bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-open">
              <Check size={16} strokeWidth={2} />
              Найдено в ЕГРЮЛ
            </div>
            <div className="mt-3 flex items-start gap-3">
              <Building2 size={22} strokeWidth={1.5} className="mt-0.5 shrink-0 text-muted" />
              <div className="min-w-0">
                <p className="font-medium">{company.name}</p>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted">ИНН</dt>
                  <dd>{company.inn}</dd>
                  {company.kpp && (
                    <>
                      <dt className="text-muted">КПП</dt>
                      <dd>{company.kpp}</dd>
                    </>
                  )}
                  {company.ogrn && (
                    <>
                      <dt className="text-muted">ОГРН</dt>
                      <dd className="break-all">{company.ogrn}</dd>
                    </>
                  )}
                  {company.city && (
                    <>
                      <dt className="text-muted">Город</dt>
                      <dd>{company.city}</dd>
                    </>
                  )}
                </dl>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-line bg-card p-5">
            <label className="block">
              <span className="mb-1.5 block text-sm text-muted">Email для входа и уведомлений</span>
              <input
                className={input}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="name@company.ru"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                Согласен на{" "}
                <Link href="/privacy" target="_blank" className="text-accent underline">
                  обработку персональных данных
                </Link>{" "}
                и с{" "}
                <Link href="/rules" target="_blank" className="text-accent underline">
                  положением о тендерах
                </Link>
              </span>
            </label>
            {errorBox}
            <button className={button} disabled={pending || !consent || !email}>
              {pending ? "Отправляем…" : "Получить код"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
