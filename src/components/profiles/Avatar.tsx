import Image from "next/image";

type Props = {
  displayName: string;
  initials: string;
  avatarUrl?: string | null;
  size?: number; // px
  className?: string;
};

// Circular avatar with a black border. Renders the participant's photo
// when available (`public/images/users/<display_name>.png`) and falls
// back to a neutral disc with their initials otherwise. Used in every
// /clasificacion table next to the participant name.
export function Avatar({ displayName, initials, avatarUrl, size = 24, className = "" }: Props) {
  const dim = { width: size, height: size };
  const ring = "border-2 border-zinc-900";

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={displayName}
        width={size}
        height={size}
        className={`${ring} shrink-0 rounded-full object-cover ${className}`}
        style={dim}
        unoptimized
      />
    );
  }

  return (
    <span
      aria-label={displayName}
      className={`${ring} inline-flex shrink-0 items-center justify-center rounded-full bg-zinc-100 font-bold text-zinc-700 ${className}`}
      style={{ ...dim, fontSize: Math.max(8, Math.round(size * 0.42)) }}
    >
      {initials.slice(0, 2).toUpperCase()}
    </span>
  );
}

type BadgeProps = Props & {
  nameClassName?: string;
  containerClassName?: string;
};

// Avatar + participant name pair. The name is rendered inline so it can
// be dropped wherever a plain display name used to live.
export function ParticipantBadge({
  displayName,
  initials,
  avatarUrl,
  size = 24,
  nameClassName = "",
  containerClassName = "",
}: BadgeProps) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${containerClassName}`}>
      <Avatar displayName={displayName} initials={initials} avatarUrl={avatarUrl} size={size} />
      <span className={`min-w-0 truncate ${nameClassName}`}>{displayName}</span>
    </span>
  );
}
