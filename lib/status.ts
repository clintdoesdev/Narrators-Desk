export type ChunkStatus = "idle" | "partial" | "queued" | "generating" | "done" | "failed" | "stale";

/**
 * One status per chunk, by priority: live job state first, then what's cached.
 * "partial" = some fresh takes but fewer than the header asks for.
 */
export function chunkStatus(
  wantedTakes: number,
  takes: { fresh: boolean }[],
  jobs: { status: "queued" | "generating" | "failed" }[],
): ChunkStatus {
  if (jobs.some((j) => j.status === "generating")) return "generating";
  if (jobs.some((j) => j.status === "queued")) return "queued";
  if (jobs.some((j) => j.status === "failed")) return "failed";
  const fresh = takes.filter((t) => t.fresh).length;
  if (fresh >= wantedTakes) return "done";
  if (takes.some((t) => !t.fresh)) return "stale";
  return fresh > 0 ? "partial" : "idle";
}

export const STATUS_LABEL: Record<ChunkStatus, string> = {
  idle: "Not generated",
  partial: "Partial",
  queued: "Queued",
  generating: "Generating",
  done: "Done",
  failed: "Failed",
  stale: "Stale",
};
