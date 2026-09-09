-- =====================================================================
--  Migration 002 — instances, audience des evenements, dates cles, leaders
--
--  A n'executer qu'une fois par base :
--    npx wrangler d1 execute apps-saussan --local  --file=./db/migrations/002-instances-et-leaders.sql
--    npx wrangler d1 execute apps-saussan --remote --file=./db/migrations/002-instances-et-leaders.sql
--
--  SQLite ne sait pas modifier une contrainte CHECK : la table events est
--  donc recreee pour accueillir la categorie « date cle » et la colonne
--  d'audience, puis les donnees y sont recopiees.
-- =====================================================================

PRAGMA defer_foreign_keys = true;

-- ---------------------------------------------------------------------
--  1. Instance des membres
--
--  Trois niveaux embostes : le bureau fait partie du comite
--  d'administration, qui fait partie des membres. La hierarchie est portee
--  par le code (lib/instances.js), pas par la base.
-- ---------------------------------------------------------------------
ALTER TABLE users ADD COLUMN instance TEXT NOT NULL DEFAULT 'membre'
  CHECK (instance IN ('membre','ca','bureau'));

-- ---------------------------------------------------------------------
--  2. Evenements : audience et categorie « date cle »
-- ---------------------------------------------------------------------
CREATE TABLE events_v2 (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  location     TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL DEFAULT 'autre'
                 CHECK (category IN ('reunion','ecole','vente','fete','sortie','date_cle','autre')),
  -- Qui est concerne dans l'espace membres. Un evenement public reste
  -- visible de tous, quelle que soit cette valeur.
  audience     TEXT NOT NULL DEFAULT 'tous'
                 CHECK (audience IN ('tous','ca','bureau')),
  start_date   TEXT NOT NULL,
  start_time   TEXT,
  end_date     TEXT NOT NULL,
  end_time     TEXT,
  all_day      INTEGER NOT NULL DEFAULT 0,
  is_public    INTEGER NOT NULL DEFAULT 0,
  created_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL,
  updated_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT,
  deleted_by   TEXT REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO events_v2 (id, title, description, location, category, audience,
                       start_date, start_time, end_date, end_time, all_day, is_public,
                       created_by, created_at, updated_by, updated_at, deleted_at, deleted_by)
SELECT id, title, description, location, category, 'tous',
       start_date, start_time, end_date, end_time, all_day, is_public,
       created_by, created_at, updated_by, updated_at, deleted_at, deleted_by
  FROM events;

DROP TABLE events;
ALTER TABLE events_v2 RENAME TO events;

CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_public ON events(is_public, start_date);
CREATE INDEX IF NOT EXISTS idx_events_deleted ON events(deleted_at);
CREATE INDEX IF NOT EXISTS idx_events_audience ON events(audience, start_date);

-- ---------------------------------------------------------------------
--  3. Equipe pilote d'un evenement
--
--  Plusieurs membres peuvent piloter un meme evenement. La suppression du
--  compte retire simplement la personne de l'equipe, sans toucher a
--  l'evenement.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_leaders (
  event_id  TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_leaders_user ON event_leaders(user_id);
