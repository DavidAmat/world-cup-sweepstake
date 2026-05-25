import * as Flags from "country-flag-icons/react/3x2";
import { COUNTRY_FLAG_MAP } from "@/lib/flags/countryFlagMap";

type FlagComponent = (props: React.SVGAttributes<SVGElement>) => React.JSX.Element;

export function TeamName({ name, className }: { name: string; className?: string }) {
  const code = COUNTRY_FLAG_MAP[name];
  const FlagComp = code ? (Flags as Record<string, FlagComponent>)[code] : undefined;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      {FlagComp && <FlagComp className="h-3.5 w-auto shrink-0" aria-hidden />}
      {name}
    </span>
  );
}
