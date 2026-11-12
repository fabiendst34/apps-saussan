-- =====================================================================
--  Migration 004 — anti-spam du formulaire de contact (kafe-socle/antispam, 12/11/2026)
--
--  Envois acceptes par empreinte d'IP (jamais l'adresse elle-meme), purges
--  au-dela d'une heure : limite a 5 messages par heure et par IP.
--  Copie de kafe-socle/src/antispam.sql.
--
--    npx wrangler d1 execute apps-saussan --remote --file=./db/migrations/004-antispam.sql
-- =====================================================================

CREATE TABLE IF NOT EXISTS antispam_envois (cle TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS antispam_envois_cle ON antispam_envois (cle, created_at);
