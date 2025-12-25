import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DocumentJobPhase,
  JobHighlight,
  JobSummary,
} from '@idynic/shared/types';

/**
 * Helper class to update document job state in the database.
 * Replaces SSE streaming with database updates that clients
 * can subscribe to via Supabase Realtime.
 */
export class JobUpdater {
  constructor(
    private supabase: SupabaseClient,
    private jobId: string
  ) {}

  /**
   * Set the current processing phase
   */
  async setPhase(phase: DocumentJobPhase, progress?: string): Promise<void> {
    const updates: Record<string, unknown> = {
      phase,
      progress: progress ?? null,
      status: 'processing',
    };

    // Set started_at on first phase transition
    const { data: job } = await this.supabase
      .from('document_jobs')
      .select('started_at')
      .eq('id', this.jobId)
      .single();

    if (!job?.started_at) {
      updates.started_at = new Date().toISOString();
    }

    await this.supabase
      .from('document_jobs')
      .update(updates)
      .eq('id', this.jobId);
  }

  /**
   * Update progress within the current phase (e.g., "3/8")
   */
  async updateProgress(progress: string): Promise<void> {
    await this.supabase
      .from('document_jobs')
      .update({ progress })
      .eq('id', this.jobId);
  }

  /**
   * Add a highlight to the job
   * These are real extracted items, not ticker messages
   */
  async addHighlight(
    text: string,
    type: JobHighlight['type'] = 'found'
  ): Promise<void> {
    // Get current highlights
    const { data: job } = await this.supabase
      .from('document_jobs')
      .select('highlights')
      .eq('id', this.jobId)
      .single();

    const currentHighlights = (job?.highlights as JobHighlight[]) || [];
    const newHighlights = [...currentHighlights, { text, type }].slice(-20); // Keep last 20

    await this.supabase
      .from('document_jobs')
      .update({ highlights: newHighlights })
      .eq('id', this.jobId);
  }

  /**
   * Add multiple highlights at once (more efficient for batches)
   */
  async addHighlights(highlights: JobHighlight[]): Promise<void> {
    const { data: job } = await this.supabase
      .from('document_jobs')
      .select('highlights')
      .eq('id', this.jobId)
      .single();

    const currentHighlights = (job?.highlights as JobHighlight[]) || [];
    const newHighlights = [...currentHighlights, ...highlights].slice(-20);

    await this.supabase
      .from('document_jobs')
      .update({ highlights: newHighlights })
      .eq('id', this.jobId);
  }

  /**
   * Set a warning message (non-fatal)
   */
  async setWarning(warning: string): Promise<void> {
    await this.supabase
      .from('document_jobs')
      .update({ warning })
      .eq('id', this.jobId);
  }

  /**
   * Mark the job as failed with an error message
   */
  async setError(error: string): Promise<void> {
    await this.supabase
      .from('document_jobs')
      .update({
        status: 'failed',
        error,
        completed_at: new Date().toISOString(),
      })
      .eq('id', this.jobId);
  }

  /**
   * Mark the job as completed with summary
   */
  async complete(summary: JobSummary, documentId: string): Promise<void> {
    await this.supabase
      .from('document_jobs')
      .update({
        status: 'completed',
        document_id: documentId,
        summary,
        completed_at: new Date().toISOString(),
      })
      .eq('id', this.jobId);
  }
}
