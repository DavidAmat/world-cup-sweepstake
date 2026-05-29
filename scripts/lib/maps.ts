// Re-export from the shared module. The Madrid → UTC conversion now
// lives in src/lib/dates/madridTime.ts and uses Intl, replacing the
// hardcoded +02:00 offset that this file used to have.

export { type Fase, resolveStage, resolveRound } from "../../src/lib/fixtures/pythonFormat";

export { madridLocalToUtcIso } from "../../src/lib/dates/madridTime";
