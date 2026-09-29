import { Building2 } from "lucide-react";

/** Фото/рендер объекта или нейтральная заглушка. */
export function ProjectCover({ id, coverImage, className = "" }: { id: string; coverImage: string | null; className?: string }) {
  if (coverImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/api/images/projects/${id}?v=${encodeURIComponent(coverImage)}`} alt="" className={`object-cover ${className}`} />
    );
  }
  return (
    <div className={`grid place-items-center bg-accent-soft text-accent ${className}`}>
      <Building2 size={40} strokeWidth={1.25} />
    </div>
  );
}
