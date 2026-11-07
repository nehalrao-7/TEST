-- One row per party. The game row has no phone numbers and no questionnaire answers.
-- Those live in dgn_room_private, still one party per row. dgn_book holds only rate limits.

CREATE TABLE IF NOT EXISTS dgn_room (
  code text PRIMARY KEY,
  version integer NOT NULL,
  active_at bigint NOT NULL DEFAULT 0,
  created_at bigint NOT NULL DEFAULT 0,
  humans integer NOT NULL DEFAULT 0,
  has_live boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS dgn_room_private (
  code text PRIMARY KEY REFERENCES dgn_room(code) ON DELETE CASCADE,
  data jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS dgn_book (
  id boolean PRIMARY KEY DEFAULT true,
  version integer NOT NULL,
  data jsonb NOT NULL,
  CONSTRAINT dgn_book_one CHECK (id)
);

CREATE TABLE IF NOT EXISTS dgn_seen (
  player_id text PRIMARY KEY,
  seen_at bigint NOT NULL
);
