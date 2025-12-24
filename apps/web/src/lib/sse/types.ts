export type ProcessingPhase =
  | "validating"
  | "parsing"
  | "extracting"
  | "embeddings"
  | "synthesis"
  | "reflection";

export interface PhaseEvent {
  phase: ProcessingPhase;
  progress?: string; // e.g., "3/8" for synthesis batches
}

export interface HighlightEvent {
  highlight: string;
}

export interface WarningEvent {
  warning: string;
}

export interface ErrorEvent {
  error: string;
}

export interface DoneEvent {
  done: true;
  summary: {
    documentId: string;
    evidenceCount: number;
    workHistoryCount: number;
    claimsCreated: number;
    claimsUpdated: number;
  };
}

export type SSEEvent =
  | PhaseEvent
  | HighlightEvent
  | WarningEvent
  | ErrorEvent
  | DoneEvent;
