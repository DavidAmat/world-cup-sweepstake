/**
 * One-off generator: writes data/seeds/wc_2026/fixtures.json from a compact
 * manifest. Useful to regenerate the seed if dates or matchday order
 * need to change. Run with: tsx scripts/wc2026/gen-fixtures.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

type GroupCode = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L";

// Display names per group, in the canonical T1..T4 order.
const GROUPS: Record<GroupCode, [string, string, string, string]> = {
  A: ["México", "Sudáfrica", "Corea del Sur", "Chequia"],
  B: ["Canadá", "Bosnia y Herzegovina", "Catar", "Suiza"],
  C: ["Brasil", "Marruecos", "Haití", "Escocia"],
  D: ["Estados Unidos", "Paraguay", "Australia", "Turquía"],
  E: ["Alemania", "Curazao", "Costa de Marfil", "Ecuador"],
  F: ["Países Bajos", "Japón", "Suecia", "Túnez"],
  G: ["Bélgica", "Egipto", "Irán", "Nueva Zelanda"],
  H: ["España", "Cabo Verde", "Arabia Saudí", "Uruguay"],
  I: ["Francia", "Senegal", "Irak", "Noruega"],
  J: ["Argentina", "Argelia", "Austria", "Jordania"],
  K: ["Portugal", "RD Congo", "Uzbekistán", "Colombia"],
  L: ["Inglaterra", "Croacia", "Ghana", "Panamá"],
};

// FIFA-style short codes per team (lowercase for external_id slugs).
const CODES: Record<string, string> = {
  México: "mex",
  Sudáfrica: "rsa",
  "Corea del Sur": "kor",
  Chequia: "cze",
  Canadá: "can",
  "Bosnia y Herzegovina": "bih",
  Catar: "qat",
  Suiza: "sui",
  Brasil: "bra",
  Marruecos: "mar",
  Haití: "hai",
  Escocia: "sco",
  "Estados Unidos": "usa",
  Paraguay: "par",
  Australia: "aus",
  Turquía: "tur",
  Alemania: "ger",
  Curazao: "cuw",
  "Costa de Marfil": "civ",
  Ecuador: "ecu",
  "Países Bajos": "ned",
  Japón: "jpn",
  Suecia: "swe",
  Túnez: "tun",
  Bélgica: "bel",
  Egipto: "egy",
  Irán: "irn",
  "Nueva Zelanda": "nzl",
  España: "esp",
  "Cabo Verde": "cpv",
  "Arabia Saudí": "ksa",
  Uruguay: "uru",
  Francia: "fra",
  Senegal: "sen",
  Irak: "irq",
  Noruega: "nor",
  Argentina: "arg",
  Argelia: "alg",
  Austria: "aut",
  Jordania: "jor",
  Portugal: "por",
  "RD Congo": "cod",
  Uzbekistán: "uzb",
  Colombia: "col",
  Inglaterra: "eng",
  Croacia: "cro",
  Ghana: "gha",
  Panamá: "pan",
};

// Canonical FIFA matchday template for a group of four [T1, T2, T3, T4]:
// J1: T1-T2, T3-T4   |   J2: T1-T3, T4-T2   |   J3: T4-T1, T2-T3
const MATCHDAYS: Record<1 | 2 | 3, Array<[0 | 1 | 2 | 3, 0 | 1 | 2 | 3]>> = {
  1: [
    [0, 1],
    [2, 3],
  ],
  2: [
    [0, 2],
    [3, 1],
  ],
  3: [
    [3, 0],
    [1, 2],
  ],
};

const GROUP_DATE: Record<1 | 2 | 3, string> = {
  1: "2026-05-29 18:00:00",
  2: "2026-06-03 18:00:00",
  3: "2026-06-10 18:00:00",
};

type Match = {
  external_id: string;
  fase: string;
  tipo_partido: "grupo" | "eliminatoria" | null;
  jornada: number | null;
  grupo: string | null;
  equipo_1: string;
  equipo_2: string;
  fecha: string;
};

const fixtures: Match[] = [];

for (const [group, teams] of Object.entries(GROUPS) as [
  GroupCode,
  [string, string, string, string],
][]) {
  for (const md of [1, 2, 3] as const) {
    for (const [aIdx, bIdx] of MATCHDAYS[md]) {
      const home = teams[aIdx];
      const away = teams[bIdx];
      fixtures.push({
        external_id: `wc2026_md${md}_${group.toLowerCase()}_${CODES[home]}_${CODES[away]}`,
        fase: "fase_grupos",
        tipo_partido: "grupo",
        jornada: md,
        grupo: group,
        equipo_1: home,
        equipo_2: away,
        fecha: GROUP_DATE[md],
      });
    }
  }
}

const knockoutTemplate: Array<{ fase: string; count: number; date: string; slug: string }> = [
  { fase: "dieciseisavos", count: 16, date: "2026-06-20 18:00:00", slug: "r32" },
  { fase: "octavos", count: 8, date: "2026-06-24 18:00:00", slug: "r16" },
  { fase: "cuartos", count: 4, date: "2026-06-28 18:00:00", slug: "qf" },
  { fase: "semis", count: 2, date: "2026-06-30 18:00:00", slug: "sf" },
  { fase: "tercer_puesto", count: 1, date: "2026-07-01 18:00:00", slug: "third" },
  { fase: "final", count: 1, date: "2026-07-01 18:00:00", slug: "final" },
];

for (const { fase, count, date, slug } of knockoutTemplate) {
  for (let i = 1; i <= count; i++) {
    const idx = String(i).padStart(2, "0");
    fixtures.push({
      external_id: `wc2026_${slug}_${idx}`,
      fase,
      tipo_partido: "eliminatoria",
      jornada: null,
      grupo: null,
      equipo_1: "TBD",
      equipo_2: "TBD",
      fecha: date,
    });
  }
}

const out = resolve(process.cwd(), "data/seeds/wc_2026/fixtures.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(fixtures, null, 2) + "\n", "utf8");
console.log(`Wrote ${fixtures.length} fixtures to ${out}`);
