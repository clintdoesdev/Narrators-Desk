import { describe, expect, it } from "vitest";
import { chunkStatus } from "@/lib/status";

const f = { fresh: true };
const s = { fresh: false };

describe("chunkStatus", () => {
  it("prioritizes live job state", () => {
    expect(chunkStatus(2, [f, f], [{ status: "generating" }, { status: "failed" }])).toBe("generating");
    expect(chunkStatus(2, [], [{ status: "queued" }, { status: "failed" }])).toBe("queued");
    expect(chunkStatus(2, [f], [{ status: "failed" }])).toBe("failed");
  });

  it("derives from cached takes", () => {
    expect(chunkStatus(2, [], [])).toBe("idle");
    expect(chunkStatus(2, [f], [])).toBe("partial");
    expect(chunkStatus(2, [f, f], [])).toBe("done");
    expect(chunkStatus(2, [f, f, f], [])).toBe("done");
    expect(chunkStatus(2, [s, s], [])).toBe("stale");
    expect(chunkStatus(2, [f, s], [])).toBe("stale");
    expect(chunkStatus(1, [f, s], [])).toBe("done");
  });
});
