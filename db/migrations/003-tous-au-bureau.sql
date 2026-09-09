-- =====================================================================
--  Migration 003 — rattachement des comptes existants au bureau
--
--  Correction de donnees, pas de schema : la migration 002 a cree la
--  colonne `instance` avec la valeur prudente 'membre' pour tout le monde.
--  Or, a cette date, tous les comptes ouverts appartiennent au bureau.
--
--  L'ordre compte : le journal est ecrit AVANT la mise a jour, pour que la
--  valeur d'avant y figure telle qu'elle etait.
--
--    npx wrangler d1 execute apps-saussan --remote --file=./db/migrations/003-tous-au-bureau.sql
-- =====================================================================

INSERT INTO audit_log
  (created_at, actor_id, actor_email, actor_name, action,
   entity_type, entity_id, entity_label, changes, ip, user_agent)
SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
       NULL, 'systeme', '', 'user.update',
       'user', id, email,
       '{"instance":["' || instance || '","bureau"]}',
       '', 'migration 003'
  FROM users
 WHERE instance <> 'bureau';

UPDATE users
   SET instance = 'bureau',
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
 WHERE instance <> 'bureau';
