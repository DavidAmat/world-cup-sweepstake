// Helpers to bridge Postgres `timestamptz` values (UTC ISO) and the
// admin UI, which deals with users thinking in `Europe/Madrid`.
//
// We deliberately avoid hardcoding the CET/CEST offset. Here we use
// `Intl.DateTimeFormat` with timeZone `"Europe/Madrid"` so winter/summer
// transitions are correct.

const MADRID_TIMEZONE = "Europe/Madrid";

const PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: MADRID_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const OFFSET_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: MADRID_TIMEZONE,
  timeZoneName: "shortOffset",
});

function getMadridOffsetMs(instant: Date): number {
  const parts = OFFSET_FORMATTER.formatToParts(instant);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+1";
  const match = tz.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!match) return 60 * 60 * 1000;
  const sign = match[1] === "+" ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3] ?? "0", 10);
  return sign * (hours * 60 + minutes) * 60 * 1000;
}

function readMadridParts(date: Date): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
} {
  const parts = PARTS_FORMATTER.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hour = get("hour");
  if (hour === "24") hour = "00";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
    second: get("second"),
  };
}

const LOCAL_PATTERNS = [
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})$/,
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/,
];

function parseMadridLocal(input: string): {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  s: number;
} {
  for (const re of LOCAL_PATTERNS) {
    const m = input.match(re);
    if (m) {
      return {
        y: parseInt(m[1], 10),
        mo: parseInt(m[2], 10),
        d: parseInt(m[3], 10),
        h: parseInt(m[4], 10),
        mi: parseInt(m[5], 10),
        s: m[6] ? parseInt(m[6], 10) : 0,
      };
    }
  }
  throw new Error(`Unrecognised Madrid-local datetime: ${input}`);
}

// Convert a wall-clock Madrid datetime to a UTC ISO string. Iterates
// once to settle the offset on a DST boundary day (the offset that
// applies depends on the instant, and the instant depends on the
// offset — one pass converges in all real-world Madrid cases).
export function madridLocalToUtcIso(input: string): string {
  const { y, mo, d, h, mi, s } = parseMadridLocal(input);
  const naive = Date.UTC(y, mo - 1, d, h, mi, s);
  let offsetMs = getMadridOffsetMs(new Date(naive));
  let utc = naive - offsetMs;
  // Re-check the offset at the candidate UTC instant; if it differs we
  // crossed a DST boundary and need to recompute once.
  const offsetMs2 = getMadridOffsetMs(new Date(utc));
  if (offsetMs2 !== offsetMs) {
    offsetMs = offsetMs2;
    utc = naive - offsetMs;
  }
  return new Date(utc).toISOString();
}

// Inverse: "YYYY-MM-DD HH:MM:SS" in Madrid local for the Python pipeline.
export function utcIsoToMadridLocal(utcIso: string): string {
  const date = new Date(utcIso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Unparseable UTC ISO: ${utcIso}`);
  }
  const p = readMadridParts(date);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

// "YYYY-MM-DDTHH:MM" suitable for <input type="datetime-local">.
export function utcIsoToMadridInput(utcIso: string): string {
  const date = new Date(utcIso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Unparseable UTC ISO: ${utcIso}`);
  }
  const p = readMadridParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

const MONTHS_ES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

// Human-readable "29-May 17h30" for table cells and badges.
export function formatMadridDateTime(utcIso: string): string {
  const date = new Date(utcIso);
  if (Number.isNaN(date.getTime())) return "—";
  const p = readMadridParts(date);
  const month = MONTHS_ES[parseInt(p.month, 10) - 1] ?? p.month;
  return `${parseInt(p.day, 10)}-${month} ${p.hour}h${p.minute}`;
}

// Full Madrid timestamp incl. year + seconds, e.g. "29-May-2026 17:30:05".
// Used for the login audit log so each access is fully identifiable.
export function formatMadridDateTimeFull(utcIso: string): string {
  const date = new Date(utcIso);
  if (Number.isNaN(date.getTime())) return "—";
  const p = readMadridParts(date);
  const month = MONTHS_ES[parseInt(p.month, 10) - 1] ?? p.month;
  return `${parseInt(p.day, 10)}-${month}-${p.year} ${p.hour}:${p.minute}:${p.second}`;
}
