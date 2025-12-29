/**
 * Document job types for background processing with Realtime updates
 */

export type DocumentJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type DocumentJobPhase =
  | 'validating'
  | 'parsing'
  | 'extracting'
  | 'embeddings'
  | 'synthesis'
  | 'reflection'
  | 'evaluation'
  | 'enriching'
  | 'researching';

export type DocumentJobType = 'resume' | 'story' | 'opportunity';

export interface JobHighlight {
  text: string;
  type: 'found' | 'created' | 'updated';
}

export interface JobSummary {
  documentId: string;
  evidenceCount: number;
  workHistoryCount: number;
  claimsCreated: number;
  claimsUpdated: number;
}

export interface DocumentJob {
  id: string;
  user_id: string;
  document_id: string | null;
  opportunity_id: string | null;
  job_type: DocumentJobType;
  filename: string | null;
  content_hash: string | null;
  status: DocumentJobStatus;
  phase: DocumentJobPhase | null;
  progress: string | null;
  highlights: JobHighlight[];
  error: string | null;
  warning: string | null;
  summary: JobSummary | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

/** Human-readable phase labels for UI */
export const PHASE_LABELS: Record<DocumentJobPhase, string> = {
  validating: 'Checking document',
  parsing: 'Parsing document',
  extracting: 'Extracting experience',
  embeddings: 'Generating embeddings',
  synthesis: 'Synthesizing claims',
  reflection: 'Reflecting identity',
  evaluation: 'Evaluating claims',
  enriching: 'Enriching job data',
  researching: 'Researching company',
};

/** Ordered phases for resume processing */
export const RESUME_PHASES: DocumentJobPhase[] = [
  'parsing',
  'extracting',
  'embeddings',
  'synthesis',
  'reflection',
  'evaluation',
];

/** Ordered phases for story processing */
export const STORY_PHASES: DocumentJobPhase[] = [
  'validating',
  'extracting',
  'embeddings',
  'synthesis',
  'reflection',
  'evaluation',
];

/** Ordered phases for opportunity processing */
export const OPPORTUNITY_PHASES: DocumentJobPhase[] = [
  'enriching',
  'extracting',
  'embeddings',
  'researching',
];

/**
 * Client-side ticker messages per phase
 * These are generated on the client to provide visual feedback
 * without storing filler messages in the database
 */
export const TICKER_MESSAGES: Record<DocumentJobPhase, string[]> = {
  validating: ['checking content...', 'validating story...'],
  parsing: ['reading document...', 'extracting text...', 'parsing pages...'],
  extracting: [
    'reading your story...',
    'scanning achievements...',
    'parsing experience...',
    'finding skills...',
    'analyzing roles...',
    'extracting details...',
    'understanding context...',
    'identifying patterns...',
    'processing history...',
  ],
  embeddings: [
    'generating vectors...',
    'processing semantics...',
    'encoding meaning...',
  ],
  synthesis: [
    'analyzing patterns...',
    'connecting experiences...',
    'finding themes...',
    'mapping skills...',
    'building narrative...',
    'discovering strengths...',
    'processing achievements...',
    'linking evidence...',
    'synthesizing identity...',
    'evaluating expertise...',
    'recognizing talents...',
    'compiling insights...',
  ],
  reflection: [
    'synthesizing identity...',
    'building profile...',
    'crafting narrative...',
  ],
  evaluation: [
    'checking claim quality...',
    'verifying grounding...',
    'validating evidence...',
  ],
  enriching: [
    'fetching job details...',
    'extracting metadata...',
    'parsing requirements...',
  ],
  researching: [
    'researching company...',
    'gathering insights...',
    'analyzing market position...',
  ],
};

/**
 * Format a highlight for display based on its type
 */
export function formatHighlight(highlight: JobHighlight): string {
  switch (highlight.type) {
    case 'found':
      return `Found: ${highlight.text}`;
    case 'created':
      return `+ ${highlight.text}`;
    case 'updated':
      return `~ ${highlight.text}`;
    default:
      return highlight.text;
  }
}
