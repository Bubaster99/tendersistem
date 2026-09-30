import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/access";
import { ProjectForm } from "../ProjectForm";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffPage();
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) notFound();
  return (
    <div className="max-w-[760px]">
      <h1 className="mb-6 font-display text-2xl">{project.name}</h1>
      <ProjectForm project={project} />
    </div>
  );
}
