/** Row shape returned by the `activity_log` select and delivered by its Realtime INSERT payload. */
export interface ActivityLogRow {
  id: string;
  description: string;
  action_type: string;
  created_at: string;
}

/**
 * Merges the activity feed's current state with a newly-arrived batch
 * (either the initial query's result set or a single Realtime row).
 *
 * Pure and commutative with respect to arrival order: calling it
 * merge(merge([], A), B) or merge(merge([], B), A) — i.e. the initial query
 * resolving before or after a Realtime event — converges on the same final
 * list, because it always dedupes the full union by id, re-sorts by
 * created_at descending, and re-applies the limit rather than trusting
 * either side's incoming order.
 */
export function mergeActivityEntries(
  existing: ActivityLogRow[],
  incoming: ActivityLogRow[],
  limit: number
): ActivityLogRow[] {
  const byId = new Map<string, ActivityLogRow>();
  for (const row of existing) byId.set(row.id, row);
  for (const row of incoming) byId.set(row.id, row);

  return [...byId.values()]
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
    .slice(0, limit);
}
