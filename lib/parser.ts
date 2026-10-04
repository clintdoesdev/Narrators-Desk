import type { Chunk, Issue, Model, ParseResult, Story } from "./types";

export const MAX_CHUNK_CHARS = 1500;
export const WARN_CHUNK_CHARS = 600;
export const DEFAULT_TAKES_V2 = 2;
export const DEFAULT_TAKES_V3 = 2;
export const MIN_TAKES = 1;
export const MAX_TAKES = 2;

const HEADER_RE = /^@@(VIDEO|TAKES_V2|TAKES_V3):\s*(.+)$/;
const SLUG_RE = /^[a-z0-9-]+$/;
const STORY_RE = /^==\s*S(\d+):\s*(.+?)\s*==$/;
const AUDIO_RE = /^\[AUDIO\s*[—–-]\s*(v2|v3)(\s*[—–-]\s*CLIMAX)?\]\s*$/;
/**
 * Any UPPERCASE production tag at line start ends an audio block: [VISUAL],
 * [SKIT], [FACT-CHECK …], [AUDIO …]. The second character must not be a
 * lowercase letter, so a mis-cased Audio Tag like [Sighs] stays in the
 * narration (and gets a warning) instead of silently truncating the block.
 */
const PRODUCTION_TAG_RE = /^\[[A-Z](?![a-z])/;
const BREAK_LINE_RE = /^<break\s+time\s*=\s*"(\d+(?:\.\d+)?)s"\s*\/?>$/;
const BREAK_ANY_RE = /<break\b[^>]*>/g;
const AUDIO_TAG_RE = /\[[a-z][^\]]*\]/g;
const MISCASED_TAG_RE = /\[[A-Z][a-z][^\]]*\]/g;
const UPPER_TAG_RE = /\[[A-Z](?![a-z])[^\]]*\]/g;
const LABEL_LIKE_RE = /^\[AUDIO\b/i;

/** Smart quotes → straight quotes. Em dashes and ellipses are left alone. */
export function normalizeQuotes(s: string): string {
  return s.replace(/[“”„‟″]/g, '"').replace(/[‘’‚‛′]/g, "'");
}

export function padIndex(n: number): string {
  return String(n).padStart(3, "0");
}

export function chunkId(story: number, index: number): string {
  return `S${story}-${padIndex(index)}`;
}

function clampTakes(raw: string, fallback: number, line: number, key: string, warnings: Issue[]): number {
  const n = Number(raw.trim());
  if (!Number.isInteger(n)) {
    warnings.push({ line, message: `@@${key} "${raw.trim()}" isn't a whole number. Using ${fallback}.` });
    return fallback;
  }
  if (n < MIN_TAKES || n > MAX_TAKES) {
    const c = Math.min(MAX_TAKES, Math.max(MIN_TAKES, n));
    warnings.push({ line, message: `@@${key} ${n} is out of range (${MIN_TAKES}–${MAX_TAKES}). Using ${c}.` });
    return c;
  }
  return n;
}

type Para = { lines: string[]; startLine: number };

type Block = {
  model: Model;
  climax: boolean;
  line: number;
  story: Story | null;
  paras: Para[];
  current: Para | null;
  /** chunk the next standalone break applies to, set as paragraphs close */
  pendingBreaks: { seconds: number; line: number; afterPara: number }[];
};

/** Strips tags so digit checks don't trip over `<break time="1s" />`. */
function narrationOnly(text: string): string {
  return text.replace(BREAK_ANY_RE, " ").replace(/\[[^\]]*\]/g, " ");
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+(?=\S)/);
}

export function parseScript(input: string): ParseResult {
  const lines = normalizeQuotes(input.replace(/\r\n?/g, "\n")).split("\n");
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const chunks: Chunk[] = [];
  const stories: Story[] = [];

  let video = "";
  let videoLine = 0;
  let takesV2 = DEFAULT_TAKES_V2;
  let takesV3 = DEFAULT_TAKES_V3;

  let story: Story | null = null;
  let storyIndex = 0;
  let block: Block | null = null;
  // Chunks are created after headers are known, so collect raw first.
  const rawChunks: Omit<Chunk, "takes">[] = [];
  const climaxStories = new Set<number>();

  const closePara = () => {
    if (!block || !block.current) return;
    block.paras.push(block.current);
    block.current = null;
  };

  const closeBlock = () => {
    if (!block) return;
    closePara();
    const b = block;
    block = null;
    if (b.paras.length === 0) {
      errors.push({ line: b.line, message: "This [AUDIO] block is empty." });
      // A break in an empty block still belongs to the previous chunk.
    }
    if (!b.story) {
      if (b.paras.length > 0) {
        errors.push({
          line: b.line,
          message: "Narration outside any story. Add a story header (== S1: Title ==) above this block.",
        });
      }
      return;
    }
    if (b.climax) climaxStories.add(b.story.number);
    const firstChunkOfBlock = rawChunks.length;
    for (const p of b.paras) {
      storyIndex += 1;
      const text = p.lines.join(" ").replace(/\s+/g, " ").trim();
      rawChunks.push({
        id: chunkId(b.story.number, storyIndex),
        story: b.story.number,
        storyTitle: b.story.title,
        index: storyIndex,
        model: b.model,
        climax: b.climax,
        text,
        chars: text.length,
        pauseAfter: null,
        line: p.startLine,
      });
    }
    for (const br of b.pendingBreaks) {
      // afterPara = number of paragraphs closed before the break (in this block).
      const target =
        br.afterPara > 0
          ? rawChunks[firstChunkOfBlock + br.afterPara - 1]
          : lastChunkOfStoryBefore(firstChunkOfBlock, b.story.number);
      if (target) target.pauseAfter = br.seconds;
      else warnings.push({ line: br.line, message: "Break has no chunk before it, so it was ignored." });
    }
  };

  const lastChunkOfStoryBefore = (end: number, storyNum: number) => {
    const c = rawChunks[end - 1];
    return c && c.story === storyNum ? c : undefined;
  };

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i];
    const line = raw.trim();

    const header = HEADER_RE.exec(line);
    if (header) {
      closeBlock();
      const [, key, value] = header;
      if (key === "VIDEO") {
        video = value.trim();
        videoLine = lineNo;
      } else if (key === "TAKES_V2") {
        takesV2 = clampTakes(value, DEFAULT_TAKES_V2, lineNo, key, warnings);
      } else {
        takesV3 = clampTakes(value, DEFAULT_TAKES_V3, lineNo, key, warnings);
      }
      continue;
    }

    const storyMatch = STORY_RE.exec(line);
    if (storyMatch) {
      closeBlock();
      story = { number: Number(storyMatch[1]), title: storyMatch[2], line: lineNo };
      if (stories.some((s) => s.number === story!.number)) {
        errors.push({ line: lineNo, message: `Story S${story.number} appears twice. Story numbers must be unique.` });
      }
      stories.push(story);
      storyIndex = 0;
      continue;
    }

    const audio = AUDIO_RE.exec(line);
    if (audio) {
      closeBlock();
      block = {
        model: audio[1] as Model,
        climax: Boolean(audio[2]),
        line: lineNo,
        story,
        paras: [],
        current: null,
        pendingBreaks: [],
      };
      continue;
    }

    if (LABEL_LIKE_RE.test(line)) {
      closeBlock();
      errors.push({
        line: lineNo,
        message: `Couldn't read this audio label. Use [AUDIO — v2], [AUDIO — v3] or [AUDIO — v3 — CLIMAX].`,
      });
      continue;
    }

    if (PRODUCTION_TAG_RE.test(line)) {
      closeBlock();
      continue;
    }

    if (!block) continue; // outside audio blocks: ignored

    if (line === "") {
      closePara();
      continue;
    }

    const brk = BREAK_LINE_RE.exec(line);
    if (brk) {
      closePara();
      block.pendingBreaks.push({ seconds: Number(brk[1]), line: lineNo, afterPara: block.paras.length });
      continue;
    }

    if (!block.current) block.current = { lines: [], startLine: lineNo };
    block.current.lines.push(line);
  }
  closeBlock();

  // Header validation
  if (!video) {
    errors.push({ line: 1, message: "Missing @@VIDEO header. Add a line like: @@VIDEO: worst-jobs-medieval" });
  } else if (!SLUG_RE.test(video)) {
    errors.push({
      line: videoLine,
      message: `@@VIDEO "${video}" must use only lowercase letters, digits and hyphens.`,
    });
  }

  for (const c of rawChunks) {
    const chunk: Chunk = { ...c, takes: c.model === "v2" ? takesV2 : takesV3 };
    chunks.push(chunk);
    validateChunk(chunk, errors, warnings);
  }

  for (const s of stories) {
    if (s.number === 0) continue;
    const hasChunks = chunks.some((c) => c.story === s.number);
    if (hasChunks && !climaxStories.has(s.number)) {
      warnings.push({ line: s.line, message: `S${s.number} "${s.title}" has no CLIMAX block.` });
    }
  }

  const byLine = (a: Issue, b: Issue) => a.line - b.line;
  errors.sort(byLine);
  warnings.sort(byLine);

  return { video: SLUG_RE.test(video) ? video : "", chunks, errors, warnings, stories, takesV2, takesV3 };
}

function validateChunk(c: Chunk, errors: Issue[], warnings: Issue[]) {
  const at = { chunkId: c.id, line: c.line };

  const audioTags = c.text.match(AUDIO_TAG_RE) ?? [];
  if (c.model === "v2" && audioTags.length > 0) {
    errors.push({
      ...at,
      message: `${c.id}: Audio Tag ${audioTags[0]} in a v2 block. v2 reads tags aloud. Move it to a v3 block or remove it.`,
    });
  }

  if (c.model === "v3" && /<break\b/.test(c.text)) {
    errors.push({ ...at, message: `${c.id}: <break> tag in a v3 block. v3 doesn't support breaks. Use punctuation or an Audio Tag.` });
  }

  const upper = c.text.match(UPPER_TAG_RE);
  if (upper) {
    errors.push({
      ...at,
      message: `${c.id}: Production tag ${upper[0]} inside narration. Put it on its own line or remove it.`,
    });
  }

  if (c.chars > MAX_CHUNK_CHARS) {
    errors.push({ ...at, message: `${c.id}: ${c.chars} characters, over the ${MAX_CHUNK_CHARS} limit. Split the paragraph.` });
  } else if (c.chars > WARN_CHUNK_CHARS) {
    warnings.push({ ...at, message: `${c.id}: ${c.chars} characters. Long chunks drift; consider splitting.` });
  }

  if (/\d/.test(narrationOnly(c.text))) {
    warnings.push({ ...at, message: `${c.id}: contains digits. Spell numbers out so they're read the way you want.` });
  }

  for (const sentence of splitSentences(c.text)) {
    const n = (sentence.match(AUDIO_TAG_RE) ?? []).length;
    if (n >= 2) {
      warnings.push({ ...at, message: `${c.id}: ${n} Audio Tags in one sentence. One per sentence reads more naturally.` });
      break;
    }
  }

  const miscased = c.text.match(MISCASED_TAG_RE);
  if (miscased) {
    warnings.push({
      ...at,
      message: `${c.id}: ${miscased[0]} should be lowercase (${miscased[0].toLowerCase()}) to work as an Audio Tag.`,
    });
  }
}
