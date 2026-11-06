CREATE TABLE IF NOT EXISTS dgn_document (
  id boolean PRIMARY KEY DEFAULT true,
  version integer NOT NULL,
  data jsonb NOT NULL,
  CONSTRAINT dgn_document_one CHECK (id)
);

CREATE TABLE IF NOT EXISTS dgn_seen (
  player_id text PRIMARY KEY,
  seen_at bigint NOT NULL
);
