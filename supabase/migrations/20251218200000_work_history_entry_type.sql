-- Add entry_type to work_history to distinguish work vs ventures vs additional experience
ALTER TABLE work_history
ADD COLUMN IF NOT EXISTS entry_type text DEFAULT 'work'
CHECK (entry_type IN ('work', 'venture', 'additional'));

COMMENT ON COLUMN work_history.entry_type IS 'Type of entry: work (regular employment), venture (entrepreneurial/side projects), additional (brief/earlier roles)';
