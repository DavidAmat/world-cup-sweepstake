const PAGE_SIZE = 1000;

// PostgREST caps each response at 1,000 rows. Tournament-wide reads
// (e.g. all match_predictions for ~15 users × 72 fixtures) exceed that,
// so callers must page until the full set is loaded.
export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}
