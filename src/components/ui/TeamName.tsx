import * as Flags from "country-flag-icons/react/3x2";
import { COUNTRY_FLAG_MAP } from "@/lib/flags/countryFlagMap";

type FlagComponent = (props: React.SVGAttributes<SVGElement>) => React.JSX.Element;

export function TeamName({
  name,
  className,
  flagOnly = false,
}: {
  name: string;
  className?: string;
  flagOnly?: boolean;
}) {
  const code = COUNTRY_FLAG_MAP[name];
  const FlagComp = code ? (Flags as Record<string, FlagComponent>)[code] : undefined;

  if (flagOnly) {
    return FlagComp ? (
      <FlagComp className={`h-3.5 w-auto shrink-0 ${className ?? ""}`} aria-label={name} />
    ) : (
      <span className={`text-[10px] uppercase ${className ?? ""}`} aria-label={name}>
        {name.slice(0, 2)}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      {FlagComp && <FlagComp className="h-3.5 w-auto shrink-0" aria-hidden />}
      {name}
    </span>
  );
}
