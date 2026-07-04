-- Cached personalized Expense Analyzer narratives (keyed by payload fingerprint)

CREATE TABLE IF NOT EXISTS expense_analyzer_narratives (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload_fingerprint TEXT NOT NULL,
  lead TEXT NOT NULL,
  paragraphs JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, payload_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_expense_analyzer_narratives_user_created
  ON expense_analyzer_narratives (user_id, created_at DESC);
