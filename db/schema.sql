-- =====================================================================
--  APPS Saussan — schema D1 (SQLite)
--  Idempotent : peut etre rejoue sans casser les donnees existantes.
-- =====================================================================

-- ---------------------------------------------------------------------
--  Comptes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT,                         -- NULL tant que le compte n'est pas active
  first_name     TEXT NOT NULL DEFAULT '',
  last_name      TEXT NOT NULL DEFAULT '',
  role           TEXT NOT NULL DEFAULT 'membre' CHECK (role IN ('membre','admin')),
  status         TEXT NOT NULL DEFAULT 'invite' CHECK (status IN ('invite','actif','suspendu')),
  title          TEXT NOT NULL DEFAULT '',     -- fonction dans le bureau (President, Tresorier...)
  phone          TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  last_login_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ---------------------------------------------------------------------
--  Sessions (le cookie ne contient qu'un token opaque, jamais l'identite)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,                -- SHA-256 du token du cookie
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  ip          TEXT NOT NULL DEFAULT '',
  user_agent  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ---------------------------------------------------------------------
--  Jetons a usage unique : activation de compte et reinitialisation
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tokens (
  id          TEXT PRIMARY KEY,                -- SHA-256 du jeton envoye par mail
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('activation','reinitialisation')),
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  used_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_tokens_user ON tokens(user_id, kind);

-- ---------------------------------------------------------------------
--  Evenements du calendrier
--  Suppression logique (deleted_at) pour garder une piste d'audit exploitable.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  location     TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL DEFAULT 'autre'
                 CHECK (category IN ('reunion','ecole','vente','fete','sortie','autre')),
  start_date   TEXT NOT NULL,                  -- AAAA-MM-JJ
  start_time   TEXT,                           -- HH:MM ou NULL si journee entiere
  end_date     TEXT NOT NULL,
  end_time     TEXT,
  all_day      INTEGER NOT NULL DEFAULT 0,
  is_public    INTEGER NOT NULL DEFAULT 0,     -- visible sur le site public
  created_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL,
  updated_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT,
  deleted_by   TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_public ON events(is_public, start_date);
CREATE INDEX IF NOT EXISTS idx_events_deleted ON events(deleted_at);

-- ---------------------------------------------------------------------
--  Journal d'audit
--  actor_email est denormalise : la trace survit a la suppression du compte.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT NOT NULL,
  actor_id      TEXT,
  actor_email   TEXT NOT NULL DEFAULT 'systeme',
  actor_name    TEXT NOT NULL DEFAULT '',
  action        TEXT NOT NULL,                 -- ex: event.create, user.delete, auth.login
  entity_type   TEXT NOT NULL DEFAULT '',      -- event | user | session
  entity_id     TEXT NOT NULL DEFAULT '',
  entity_label  TEXT NOT NULL DEFAULT '',      -- libelle lisible au moment de l'action
  changes       TEXT NOT NULL DEFAULT '',      -- JSON { champ: [avant, apres] }
  ip            TEXT NOT NULL DEFAULT '',
  user_agent    TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);

-- ---------------------------------------------------------------------
--  Contenus editables depuis l'admin (textes de la page d'accueil, etc.)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL DEFAULT '',
  updated_at  TEXT NOT NULL,
  updated_by  TEXT
);

-- ---------------------------------------------------------------------
--  Messages recus via le formulaire de contact public
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  subject     TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  ip          TEXT NOT NULL DEFAULT '',
  read_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_date ON messages(created_at DESC);

-- ---------------------------------------------------------------------
--  Medias : images mises en avant des articles.
--
--  Le binaire est stocke dans D1 faute de R2 active sur le compte. Les
--  images sont redimensionnees dans le navigateur avant l'envoi, ce qui
--  garde les lignes sous quelques centaines de kilo-octets. Le jour ou R2
--  est active, seul src/lib/medias.js change : le reste du code passe par
--  son interface.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medias (
  id            TEXT PRIMARY KEY,
  content_type  TEXT NOT NULL,
  taille        INTEGER NOT NULL,
  largeur       INTEGER,
  hauteur       INTEGER,
  nom_origine   TEXT NOT NULL DEFAULT '',
  donnees       BLOB NOT NULL,
  created_at    TEXT NOT NULL,
  created_by    TEXT REFERENCES users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
--  Articles « À la une »
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS articles (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  chapo         TEXT NOT NULL DEFAULT '',   -- resume affiche dans les listes
  body          TEXT NOT NULL DEFAULT '',
  image_id      TEXT REFERENCES medias(id) ON DELETE SET NULL,
  image_alt     TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'brouillon' CHECK (status IN ('brouillon','publie')),
  is_featured   INTEGER NOT NULL DEFAULT 0,  -- remonte dans « À la une » sur l'accueil
  published_at  TEXT,
  created_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL,
  updated_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  deleted_by    TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_articles_public ON articles(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_deleted ON articles(deleted_at);
