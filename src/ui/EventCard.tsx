/** Event card for horizontal rails: poster photo, a tracked-caps date line, a serif title. */
import { Eyebrow } from './Eyebrow';
import { Photo } from './Photo';

export function EventCard({
  poster,
  when,
  title,
  where,
  onClick,
}: {
  poster: string;
  when: string;
  title: string;
  where: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-52 shrink-0 snap-start flex-col gap-2.5 text-start transition-transform active:scale-[0.98]"
    >
      <Photo src={poster} className="rounded-tile h-32 w-full" />
      <Eyebrow className="text-brand">{when}</Eyebrow>
      <span className="font-serif-display text-serif-section text-text-title -mt-1">{title}</span>
      <span className="text-body-3 text-text-muted -mt-1.5">{where}</span>
    </button>
  );
}
