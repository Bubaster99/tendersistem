import { requireStaffPage } from "@/lib/access";
import { ContactForm } from "../ContactForm";

export default async function NewContactPage() {
  await requireStaffPage();
  return (
    <div className="max-w-[760px]">
      <h1 className="mb-6 font-display text-2xl">Новый контакт</h1>
      <ContactForm />
    </div>
  );
}
