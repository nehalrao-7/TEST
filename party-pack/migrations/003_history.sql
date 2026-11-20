-- One small row per finished or abandoned party, for the admin dashboard (/admin).
-- Counts only: no names, emails or answers. The server creates this itself when its
-- database login is allowed to; run this by hand if the dashboard says history is unavailable.
-- Replace ppk with your DB_PREFIX.
CREATE TABLE IF NOT EXISTS ppk_history (
  id text PRIMARY KEY,
  ended_at bigint NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS ppk_history_ended ON ppk_history (ended_at DESC);
