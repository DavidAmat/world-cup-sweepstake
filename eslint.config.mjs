import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Repo-specific:
    ".venv/**", // Python pipeline (parallel tooling, not app code)
    "data/**", // raw + seed JSONs
    "context/**", // markdown + plan docs
    "supabase/**", // SQL migrations + config
    "scripts/**", // seeders run outside Next (added in hito 06)
    "src/lib/supabase/database.types.ts", // auto-generated
  ]),
]);

export default eslintConfig;
