-- Mystery Box App — Supabase setup (run once in the SQL editor)
-- Lean schema: 2 tables. Identity, roles, unlock time, wildcards all live
-- in src/config.ts + src/data.ts — no events/participants tables.

CREATE TABLE boxes (
  contestant_id TEXT PRIMARY KEY,
  choice1 TEXT,
  choice2 TEXT,
  challenge_note TEXT CHECK (char_length(challenge_note) <= 175),
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ
);

CREATE TABLE contestant_status (
  contestant_id TEXT PRIMARY KEY,
  status TEXT CHECK (status IN ('researching', 'shopping', 'cooking', 'plating', 'done')),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Open access: private 4-person app, anon key can read/write everything.
ALTER TABLE boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contestant_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow all" ON boxes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON contestant_status FOR ALL USING (true) WITH CHECK (true);

-- Seed empty rows so clients only ever UPSERT (no INSERT-vs-UPDATE branching).
INSERT INTO boxes (contestant_id) VALUES ('ethan'), ('prash');
INSERT INTO contestant_status (contestant_id) VALUES ('ethan'), ('prash');

-- Realtime: both tables must be in the publication or subscriptions get nothing.
ALTER PUBLICATION supabase_realtime ADD TABLE boxes;
ALTER PUBLICATION supabase_realtime ADD TABLE contestant_status;
