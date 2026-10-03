import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseScript } from "@/lib/parser";

const example = readFileSync(join(__dirname, "..", "fixtures", "example.txt"), "utf8");

const HEAD = "@@VIDEO: test-video\n";
const parse = (body: string) => parseScript(HEAD + body);
const msgs = (issues: { message: string }[]) => issues.map((i) => i.message).join("\n");

describe("example fixture", () => {
  const r = parseScript(example);

  it("parses without errors", () => {
    expect(r.errors).toEqual([]);
    expect(r.video).toBe("worst-jobs-medieval");
    expect(r.takesV2).toBe(2);
    expect(r.takesV3).toBe(4);
  });

  it("produces the expected chunks", () => {
    expect(r.chunks.map((c) => c.id)).toEqual(["S0-001", "S1-001", "S1-002", "S1-003", "S1-004", "S1-005"]);
    const [cold, raker, its, see, climax, outro] = r.chunks;
    expect(cold).toMatchObject({ story: 0, storyTitle: "Cold Open", model: "v2", climax: false, takes: 2 });
    expect(raker.text).toBe("Richard the Raker.");
    expect(raker.pauseAfter).toBe(1);
    expect(its.text).toBe(
      "It's thirteen twenty-six, and a man named Richard is shoveling human waste out of a London cesspit...",
    );
    expect(its.pauseAfter).toBeNull();
    expect(see.text).toBe("See, Richard had one of the most important jobs in the city. And one of the worst.");
    expect(climax).toMatchObject({ model: "v3", climax: true, takes: 4, index: 4 });
    expect(climax.text).toBe("The floorboards groan. [gasps] And then... they give way.");
    expect(outro).toMatchObject({ model: "v3", climax: false, text: "So, yeah. [sighs] Go figure." });
    expect(outro.chars).toBe(outro.text.length);
  });

  it("records source lines", () => {
    expect(r.chunks[0].line).toBe(7);
    expect(r.chunks[2].line).toBe(13);
  });

  it("does not warn about a missing climax in S0 or in S1", () => {
    expect(msgs(r.warnings)).not.toMatch(/CLIMAX/);
  });
});

describe("header", () => {
  it("errors on missing @@VIDEO", () => {
    const r = parseScript("== S1: A ==\n[AUDIO — v2]\nHello.");
    expect(msgs(r.errors)).toMatch(/Missing @@VIDEO/);
  });

  it("errors on an invalid slug", () => {
    const r = parseScript("@@VIDEO: Worst Jobs\n== S1: A ==\n[AUDIO — v2]\nHello.");
    expect(r.errors[0]).toMatchObject({ line: 1 });
    expect(msgs(r.errors)).toMatch(/lowercase letters/);
    expect(r.video).toBe("");
  });

  it("defaults takes to 2 and 4", () => {
    const r = parse("== S1: A ==\n[AUDIO — v2]\nOne.\n[AUDIO — v3 — CLIMAX]\nTwo.");
    expect(r.chunks.map((c) => c.takes)).toEqual([2, 4]);
  });

  it("clamps takes to 1–6", () => {
    const r = parseScript("@@VIDEO: x\n@@TAKES_V2: 0\n@@TAKES_V3: 9\n== S1: A ==\n[AUDIO — v2]\nOne.\n[AUDIO — v3 — CLIMAX]\nTwo.");
    expect(r.takesV2).toBe(1);
    expect(r.takesV3).toBe(6);
    expect(r.warnings.length).toBeGreaterThanOrEqual(2);
  });

  it("falls back on non-numeric takes", () => {
    const r = parseScript("@@VIDEO: x\n@@TAKES_V3: lots\n");
    expect(r.takesV3).toBe(4);
    expect(msgs(r.warnings)).toMatch(/whole number/);
  });
});

describe("stories and numbering", () => {
  it("restarts chunk numbering per story and continues across blocks", () => {
    const r = parse(
      "== S1: A ==\n[AUDIO — v3 — CLIMAX]\nA.\n\nB.\n[AUDIO — v2]\nC.\n== S2: B ==\n[AUDIO — v3 — CLIMAX]\nD.",
    );
    expect(r.chunks.map((c) => c.id)).toEqual(["S1-001", "S1-002", "S1-003", "S2-001"]);
    expect(r.chunks[3].storyTitle).toBe("B");
  });

  it("errors on narration outside any story", () => {
    const r = parse("[AUDIO — v2]\nOrphan line.\n== S1: A ==\n[AUDIO — v3 — CLIMAX]\nOk.");
    expect(msgs(r.errors)).toMatch(/outside any story/);
    expect(r.chunks.map((c) => c.id)).toEqual(["S1-001"]);
  });

  it("warns when a story has no CLIMAX block, but exempts S0", () => {
    const r = parse("== S0: Open ==\n[AUDIO — v2]\nHi.\n== S1: Body ==\n[AUDIO — v2]\nNo climax.");
    const w = r.warnings.filter((x) => /CLIMAX/.test(x.message));
    expect(w).toHaveLength(1);
    expect(w[0].message).toMatch(/S1/);
    expect(w[0].line).toBe(5);
  });
});

describe("audio labels", () => {
  it("accepts em dash, en dash and hyphen labels", () => {
    const r = parse(
      "== S1: A ==\n[AUDIO — v2]\nEm.\n[AUDIO – v3 – CLIMAX]\nEn.\n[AUDIO - v3]\nHyphen.\n[AUDIO-v2]\nTight.",
    );
    expect(r.errors).toEqual([]);
    expect(r.chunks.map((c) => [c.model, c.climax])).toEqual([
      ["v2", false],
      ["v3", true],
      ["v3", false],
      ["v2", false],
    ]);
  });

  it("errors on a malformed audio label", () => {
    const r = parse("== S1: A ==\n[AUDIO — v4]\nHmm.");
    expect(msgs(r.errors)).toMatch(/Couldn't read this audio label/);
  });

  it("errors on an empty block", () => {
    const r = parse("== S1: A ==\n[AUDIO — v2]\n\n[VISUAL] something\n[AUDIO — v3 — CLIMAX]\nOk.");
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ line: 3 });
    expect(r.errors[0].message).toMatch(/empty/);
  });

  it("errors on an empty block at EOF", () => {
    const r = parse("== S1: A ==\n[AUDIO — v3 — CLIMAX]\n");
    expect(msgs(r.errors)).toMatch(/empty/);
  });
});

describe("block boundaries", () => {
  it("ignores text outside audio blocks", () => {
    const r = parse("Some notes\n== S1: A ==\nDirector's note here.\n[AUDIO — v3 — CLIMAX]\nSpoken.");
    expect(r.chunks.map((c) => c.text)).toEqual(["Spoken."]);
  });

  it("[VISUAL] between two paragraphs ends the block", () => {
    const r = parse("== S1: A ==\n[AUDIO — v3 — CLIMAX]\nFirst.\n[VISUAL] MAP — London — 4s\nNot narration.\n\nAlso not.");
    expect(r.chunks.map((c) => c.text)).toEqual(["First."]);
  });

  it("a paragraph that starts with [sighs] stays narration", () => {
    const r = parse("== S1: A ==\n[AUDIO — v3 — CLIMAX]\nFirst.\n\n[sighs] Well, that happened.\nAnd then more.");
    expect(r.chunks.map((c) => c.text)).toEqual(["First.", "[sighs] Well, that happened. And then more."]);
    expect(r.errors).toEqual([]);
  });

  it("a mid-paragraph line starting with [laughs] stays narration", () => {
    const r = parse("== S1: A ==\n[AUDIO — v3 — CLIMAX]\nHe said no.\n[laughs] Of course he did.");
    expect(r.chunks).toHaveLength(1);
    expect(r.chunks[0].text).toBe("He said no. [laughs] Of course he did.");
  });

  it("a story header ends a block", () => {
    const r = parse("== S1: A ==\n[AUDIO — v3 — CLIMAX]\nOne.\n== S2: B ==\nNot narration.");
    expect(r.chunks.map((c) => c.text)).toEqual(["One."]);
  });

  it("handles a pasted full script with VISUAL, SKIT and FACT-CHECK lines", () => {
    const script = [
      "@@VIDEO: plague-doctors",
      "@@TAKES_V2: 3",
      "Title ideas: The Beak, The Mask",
      "",
      "== S1: The Mask ==",
      "[VISUAL] OPEN — candlelit street — 5s",
      "[AUDIO — v2]",
      "In sixteen fifty-six, a doctor walks into Rome",
      "wearing a bird mask.",
      "",
      "Nobody laughs.",
      "[SKIT] Doctor knocks; villager screams",
      "Villager: AAAH!",
      "[AUDIO — v3 — CLIMAX]",
      "[whispers] The mask was full of herbs.",
      "[FACT-CHECK — source: Ruisinger 2020]",
      "Confirm the beak contents.",
      "[AUDIO — v3]",
      "It didn't help. [sighs]",
      "",
      "[SPONSOR] read",
      "This video is sponsored by nobody.",
    ].join("\n");
    const r = parseScript(script);
    expect(r.errors).toEqual([]);
    expect(r.video).toBe("plague-doctors");
    expect(r.chunks.map((c) => [c.id, c.text, c.takes])).toEqual([
      ["S1-001", "In sixteen fifty-six, a doctor walks into Rome wearing a bird mask.", 3],
      ["S1-002", "Nobody laughs.", 3],
      ["S1-003", "[whispers] The mask was full of herbs.", 4],
      ["S1-004", "It didn't help. [sighs]", 4],
    ]);
  });
});

describe("paragraphs and whitespace", () => {
  it("splits on one or more blank lines and collapses whitespace", () => {
    const r = parse("== S1: A ==\n[AUDIO — v3 — CLIMAX]\n  One   two\n\tthree  \n\n\n\nFour.\n   \nFive.");
    expect(r.chunks.map((c) => c.text)).toEqual(["One two three", "Four.", "Five."]);
  });

  it("handles CRLF line endings", () => {
    const r = parseScript("@@VIDEO: x\r\n== S1: A ==\r\n[AUDIO — v3 — CLIMAX]\r\nOne\r\ntwo.\r\n\r\nThree.");
    expect(r.chunks.map((c) => c.text)).toEqual(["One two.", "Three."]);
  });
});

describe("breaks", () => {
  it("a standalone break sets pauseAfter on the previous chunk and splits the paragraph", () => {
    const r = parse('== S1: A ==\n[AUDIO — v2]\nOne.\n<break time="1.5s" />\nTwo.');
    expect(r.chunks.map((c) => [c.text, c.pauseAfter])).toEqual([
      ["One.", 1.5],
      ["Two.", null],
    ]);
  });

  it("a break at the end of a block applies to the block's last chunk", () => {
    const r = parse('== S1: A ==\n[AUDIO — v2]\nOne.\n\nTwo.\n<break time="2s" />\n[VISUAL] cut\n[AUDIO — v3 — CLIMAX]\nThree.');
    expect(r.chunks.map((c) => c.pauseAfter)).toEqual([null, 2, null]);
  });

  it("a break at EOF applies to the last chunk", () => {
    const r = parse('== S1: A ==\n[AUDIO — v3 — CLIMAX]\nOne.\n\n<break time="3s" />');
    expect(r.chunks[0].pauseAfter).toBe(3);
    expect(r.errors).toEqual([]);
  });

  it("a break at the start of a block applies to the story's previous chunk", () => {
    const r = parse('== S1: A ==\n[AUDIO — v2]\nOne.\n[AUDIO — v3 — CLIMAX]\n<break time="1s" />\nTwo.');
    expect(r.chunks.map((c) => c.pauseAfter)).toEqual([1, null]);
  });

  it("warns when a break has nothing before it", () => {
    const r = parse('== S1: A ==\n[AUDIO — v3 — CLIMAX]\n<break time="1s" />\nOne.');
    expect(msgs(r.warnings)).toMatch(/no chunk before/);
  });

  it("keeps inline breaks inside a v2 paragraph", () => {
    const r = parse('== S1: A ==\n[AUDIO — v2]\nWait for it. <break time="1s" /> There.\n[AUDIO — v3 — CLIMAX]\nX.');
    expect(r.chunks[0].text).toBe('Wait for it. <break time="1s" /> There.');
    expect(r.errors).toEqual([]);
    // the "1" inside the break tag is not a digit warning
    expect(msgs(r.warnings)).not.toMatch(/digits/);
  });

  it("errors on an inline break in a v3 chunk", () => {
    const r = parse('== S1: A ==\n[AUDIO — v3 — CLIMAX]\nWait. <break time="1s" /> Now.');
    expect(msgs(r.errors)).toMatch(/<break> tag in a v3 block/);
    expect(r.errors[0].chunkId).toBe("S1-001");
  });

  it("normalizes smart quotes in break tags", () => {
    const r = parse("== S1: A ==\n[AUDIO — v2]\nOne.\n<break time=“1s” />\nTwo.");
    expect(r.chunks[0].pauseAfter).toBe(1);
  });
});

describe("normalization", () => {
  it("normalizes smart quotes but keeps em dashes and ellipses", () => {
    const r = parse("== S1: A ==\n[AUDIO — v3 — CLIMAX]\n“It’s fine” — he said…");
    expect(r.chunks[0].text).toBe("\"It's fine\" — he said…");
  });
});

describe("validation errors", () => {
  it("errors on a lowercase tag in a v2 chunk", () => {
    const r = parse("== S1: A ==\n[AUDIO — v2]\nHe paused. [sighs] Then went on.");
    expect(msgs(r.errors)).toMatch(/Audio Tag \[sighs\] in a v2 block/);
  });

  it("errors on a v2 paragraph that starts with a tag", () => {
    const r = parse("== S1: A ==\n[AUDIO — v2]\n[sighs] Fine.");
    expect(r.errors).toHaveLength(1);
  });

  it("errors on an uppercase tag inside narration", () => {
    const r = parse("== S1: A ==\n[AUDIO — v3 — CLIMAX]\nAnd then [BEAT] nothing.");
    expect(msgs(r.errors)).toMatch(/Production tag \[BEAT\] inside narration/);
  });

  it("errors on a chunk over 1,500 characters", () => {
    const long = "word ".repeat(320).trim(); // 1599 chars
    const r = parse(`== S1: A ==\n[AUDIO — v3 — CLIMAX]\n${long}`);
    expect(msgs(r.errors)).toMatch(/over the 1500 limit/);
    expect(msgs(r.warnings)).not.toMatch(/Long chunks/);
  });
});

describe("validation warnings", () => {
  it("warns on digits in narration", () => {
    const r = parse("== S1: A ==\n[AUDIO — v3 — CLIMAX]\nIn 1326, things were bad.");
    expect(msgs(r.warnings)).toMatch(/contains digits/);
  });

  it("warns on a chunk over 600 characters", () => {
    const text = "word ".repeat(130).trim(); // 649 chars
    const r = parse(`== S1: A ==\n[AUDIO — v3 — CLIMAX]\n${text}`);
    expect(msgs(r.warnings)).toMatch(/649 characters/);
    expect(r.errors).toEqual([]);
  });

  it("warns on two Audio Tags in one sentence", () => {
    const r = parse("== S1: A ==\n[AUDIO — v3 — CLIMAX]\n[sighs] He fell [gasps] down. [laughs] Fine.");
    expect(msgs(r.warnings)).toMatch(/2 Audio Tags in one sentence/);
  });

  it("does not warn on one tag per sentence", () => {
    const r = parse("== S1: A ==\n[AUDIO — v3 — CLIMAX]\n[sighs] He fell. [laughs] Fine.");
    expect(msgs(r.warnings)).not.toMatch(/one sentence/);
  });

  it("warns on an uppercase-variant Audio Tag, even at line start", () => {
    const r = parse("== S1: A ==\n[AUDIO — v3 — CLIMAX]\nFirst.\n[Sighs] Again.");
    expect(r.chunks).toHaveLength(1);
    expect(r.chunks[0].text).toBe("First. [Sighs] Again.");
    expect(msgs(r.warnings)).toMatch(/\[Sighs\] should be lowercase/);
    expect(r.errors).toEqual([]);
  });

  it("reports issues in line order with chunk ids", () => {
    const r = parse("== S1: A ==\n[AUDIO — v3 — CLIMAX]\nOne 1.\n\nTwo 2.");
    const digits = r.warnings.filter((w) => /digits/.test(w.message));
    expect(digits.map((d) => [d.chunkId, d.line])).toEqual([
      ["S1-001", 4],
      ["S1-002", 6],
    ]);
  });
});

describe("bundled example", () => {
  it("matches fixtures/example.txt", async () => {
    const { EXAMPLE_SCRIPT } = await import("@/lib/example");
    expect(EXAMPLE_SCRIPT).toBe(example);
  });
});
