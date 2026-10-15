import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserPage } from "@/lib/access";
import { OnboardingForm } from "./OnboardingForm";

export const metadata = { title: "Расскажите о компании — Тендерная площадка" };

/** Мини-анкета первого входа (раздел 4.2). */
export default async function WelcomePage() {
  const user = await requireUserPage();
  if (user.role !== "contractor" || !user.company || user.company.onboardedAt) redirect("/objects");
  const workTypes = await prisma.workType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <div className="mx-auto max-w-[680px]">
      <h1 className="font-display text-2xl sm:text-3xl">Расскажите о компании</h1>
      <p className="mt-2 text-muted">
        Займёт минуту. По выбранным видам работ мы будем присылать письма, когда откроется приём КП. Анкету можно пропустить.
      </p>
      <OnboardingForm workTypes={workTypes} defaultRegion={user.company.city ?? ""} />
    </div>
  );
}
