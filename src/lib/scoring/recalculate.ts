import "server-only";

// Stub — the real scoring engine lands in hito 11. confirmMatchResult calls
// this after a result is confirmed so the wiring is in place from hito 10.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- param is part of the hito 11 contract
export async function recalculateTournamentScores(_tournamentId: string): Promise<void> {}
