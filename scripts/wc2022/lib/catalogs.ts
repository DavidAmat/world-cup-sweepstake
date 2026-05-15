// Re-export from the shared module so the admin UI (hito 07) and the
// seeder scripts (hito 06) stay on the same source of truth.

export { STAGES, ROUNDS, type StageCode, type RoundCode } from "../../../src/lib/fixtures/catalogs";
