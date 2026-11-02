import type { AiAction } from "./ai.ts";

export interface DocumentRecord {
  hash: string;
  name: string;
  size: number;
  pageCount: number;
  lastOpenedAt: number;
}

export interface StudyDraft {
  pageNumber: number;
  selectedText: string;
  action: AiAction | "note";
  result: string;
  note: string;
  question?: string;
  model?: string;
}

export interface StudyEntry extends StudyDraft {
  id: string;
  documentHash: string;
  timestamp: number;
}

export type SaveStudyEntry = (draft: StudyDraft) => Promise<void>;
