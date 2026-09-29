import Link from "next/link";
import { requireStaffPage } from "@/lib/access";
import { TenderForm } from "../TenderForm";
import { tenderFormOptions } from "../options";

export default async function NewTenderPage() {
  await requireStaffPage();
  const options = await tenderFormOptions();

  return (
    <div className="max-w-[860px]">
      <h1 className="font-display text-2xl">Новый тендер</h1>
      <p className="mt-2 mb-6 text-muted">Документы можно загрузить сразу после сохранения.</p>
      {options.projects.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-5">
          Сначала{" "}
          <Link href="/admin/projects/new" className="text-accent underline">
            добавьте объект
          </Link>
          .
        </p>
      ) : (
        <TenderForm options={options} />
      )}
    </div>
  );
}
