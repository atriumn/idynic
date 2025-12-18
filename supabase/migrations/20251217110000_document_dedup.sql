-- Add content hash for document deduplication
ALTER TABLE documents ADD COLUMN content_hash text;

-- Index for fast lookup
CREATE INDEX documents_user_hash_idx ON documents(user_id, content_hash);

-- Unique constraint: same user can't have duplicate documents
CREATE UNIQUE INDEX documents_user_hash_unique ON documents(user_id, content_hash)
  WHERE content_hash IS NOT NULL;
