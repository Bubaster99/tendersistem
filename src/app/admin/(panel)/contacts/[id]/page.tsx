import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/access";
import { ContactForm } from "../ContactForm";

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffPage();
  const { id } = await params;
  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact) notFound();
  return (
    <div className="max-w-[760px]">
      <h1 className="mb-6 font-display text-2xl">{contact.name}</h1>
      <ContactForm contact={contact} />
    </div>
  );
}
