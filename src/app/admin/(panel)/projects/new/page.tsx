import { requireStaffPage } from "@/lib/access";
import { ProjectForm } from "../ProjectForm";

export default async function NewProjectPage() {
  await requireStaffPage();
  return (
    <div className="max-w-[760px]">
      <h1 className="mb-6 font-display text-2xl">Новый объект</h1>
      <ProjectForm />
    </div>
  );
}
