export type Model = "v2" | "v3";

export type Chunk = {
  id: string; // "S1-007"
  story: number;
  storyTitle: string;
  index: number; // 1-based within story
  model: Model;
  climax: boolean;
  text: string;
  chars: number;
  pauseAfter: number | null;
  takes: number; // from header defaults
  line: number; // 1-based line of the paragraph's first line (for tap-to-jump)
};

export type Issue = { chunkId?: string; line: number; message: string };

export type Story = { number: number; title: string; line: number };

export type ParseResult = {
  video: string;
  chunks: Chunk[];
  errors: Issue[];
  warnings: Issue[];
  stories: Story[];
  takesV2: number;
  takesV3: number;
};
