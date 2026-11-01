export interface Poem {
  id: string;
  index: number;
  content: string;
}

export interface Group {
  id: string;
  name: string;
  poemIds: string[];
}

export type CorpusRef = "all" | "none" | { groupId: string };
