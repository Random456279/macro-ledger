-- Macro Ledger D1 schema. Applied by tools/setup.mjs (remote) and the local test harness.
CREATE TABLE IF NOT EXISTS devices (
  key_hash TEXT PRIMARY KEY,          -- sha256 of the device key the phone holds
  user_id  TEXT NOT NULL,             -- one user can have several devices/keys
  label    TEXT,
  created  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS devices_user ON devices(user_id);

CREATE TABLE IF NOT EXISTS docs (
  user_id TEXT NOT NULL,
  kind    TEXT NOT NULL,              -- profile | foods | meals | days
  id      TEXT NOT NULL,              -- 'me' for profile, food/meal id, or yyyy-mm-dd for days
  data    TEXT NOT NULL,              -- JSON
  updated INTEGER NOT NULL,           -- client timestamp, last writer wins
  PRIMARY KEY (user_id, kind, id)
);

CREATE TABLE IF NOT EXISTS ai_usage (
  user_id    TEXT NOT NULL,
  day        TEXT NOT NULL,           -- yyyy-mm-dd UTC
  calls      INTEGER NOT NULL DEFAULT 0,
  in_tokens  INTEGER NOT NULL DEFAULT 0,
  out_tokens INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
