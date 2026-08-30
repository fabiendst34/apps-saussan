-- =====================================================================
--  Jeu de donnees de DEMONSTRATION — developpement local uniquement.
--  Ne jamais executer en production : les mots de passe y sont connus.
--
--  Comptes crees :
--    admin@apps-saussan.fr   / AppsSaussan2026   (administrateur)
--    membre@apps-saussan.fr  / AppsSaussan2026   (membre)
--    invite@apps-saussan.fr  — compte en attente d'activation
-- =====================================================================

DELETE FROM audit_log;
DELETE FROM messages;
DELETE FROM tokens;
DELETE FROM sessions;
DELETE FROM events;
DELETE FROM users;

INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, title, phone, created_at, updated_at) VALUES
 ('u-admin',  'admin@apps-saussan.fr',
  'pbkdf2$50000$SoxBkQmU+OVW1ZFKaDI/oA==$S6W2dj9AujIkcU9Liv+RbpOMITmDm+5lG+ZQMuVZxSg=',
  'Fabien', 'Dupont', 'admin', 'actif', 'Vice-président', '', '2026-08-01T09:00:00.000Z', '2026-08-01T09:00:00.000Z'),
 ('u-membre', 'membre@apps-saussan.fr',
  'pbkdf2$50000$SoxBkQmU+OVW1ZFKaDI/oA==$S6W2dj9AujIkcU9Liv+RbpOMITmDm+5lG+ZQMuVZxSg=',
  'Camille', 'Martin', 'membre', 'actif', 'Trésorière', '', '2026-08-02T09:00:00.000Z', '2026-08-02T09:00:00.000Z'),
 ('u-invite', 'invite@apps-saussan.fr', NULL,
  'Sofia', 'Nguyen', 'membre', 'invite', '', '', '2026-08-20T09:00:00.000Z', '2026-08-20T09:00:00.000Z');

INSERT INTO events (id, title, description, location, category, start_date, start_time, end_date, end_time,
                    all_day, is_public, created_by, created_at, updated_by, updated_at) VALUES
 ('ev-1', 'Réunion de rentrée du bureau',
  'Ordre du jour : bilan de l''année écoulée, calendrier des actions, répartition des rôles.',
  'Centre Socio-culturel', 'reunion', '2026-09-08', '20:30', '2026-09-08', '22:00', 0, 0,
  'u-admin', '2026-08-05T10:00:00.000Z', 'u-admin', '2026-08-05T10:00:00.000Z'),

 ('ev-2', 'Assemblée générale annuelle',
  'Présentation du bilan moral et financier, vote du budget et élection du nouveau bureau. Ouverte à toutes les familles adhérentes.',
  'Salle polyvalente de Saussan', 'reunion', '2026-09-26', '18:30', '2026-09-26', '20:30', 0, 1,
  'u-admin', '2026-08-05T10:05:00.000Z', 'u-admin', '2026-08-05T10:05:00.000Z'),

 ('ev-3', 'Vente de gâteaux à la sortie de l''école',
  'Vente au profit des sorties scolaires. Les parents volontaires peuvent déposer leurs gâteaux le matin.',
  'Devant l''école élémentaire', 'vente', '2026-10-09', '16:15', '2026-10-09', '17:30', 0, 1,
  'u-membre', '2026-08-06T14:00:00.000Z', 'u-membre', '2026-08-06T14:00:00.000Z'),

 ('ev-4', 'Halloween des Pitchouns',
  'Défilé costumé dans le village suivi d''un goûter. Rendez-vous devant la mairie.',
  'Place de la Fontaine', 'fete', '2026-10-31', '17:00', '2026-10-31', '19:30', 0, 1,
  'u-membre', '2026-08-06T14:10:00.000Z', 'u-membre', '2026-08-06T14:10:00.000Z'),

 ('ev-5', 'Préparation du marché de Noël',
  'Confection des décorations et mise en sachet des chocolats. Toutes les bonnes volontés sont bienvenues.',
  'Centre Socio-culturel', 'ecole', '2026-11-21', '14:00', '2026-11-21', '18:00', 0, 0,
  'u-admin', '2026-08-07T09:30:00.000Z', 'u-admin', '2026-08-07T09:30:00.000Z'),

 ('ev-6', 'Marché de Noël de l''école',
  'Stands des enfants, vin chaud, crêpes et tombola. Les bénéfices financent la classe découverte des CM.',
  'Cour de l''école élémentaire', 'fete', '2026-12-12', '10:00', '2026-12-12', '17:00', 0, 1,
  'u-admin', '2026-08-07T09:35:00.000Z', 'u-admin', '2026-08-07T09:35:00.000Z'),

 ('ev-7', 'Conseil d''école — 1er trimestre',
  'Représentation des parents élus. Points à remonter : cantine, périscolaire, travaux de la cour.',
  'École élémentaire', 'reunion', '2026-11-13', '18:00', '2026-11-13', '20:00', 0, 0,
  'u-admin', '2026-08-07T09:40:00.000Z', 'u-admin', '2026-08-07T09:40:00.000Z'),

 ('ev-8', 'Carnaval de Saussan',
  'Défilé costumé dans les rues du village avec la fanfare, puis bataille de confettis sur la place.',
  'Village de Saussan', 'fete', '2027-03-20', NULL, '2027-03-20', NULL, 1, 1,
  'u-membre', '2026-08-08T11:00:00.000Z', 'u-membre', '2026-08-08T11:00:00.000Z'),

 ('ev-9', 'Kermesse de fin d''année',
  'La grande fête de l''année : jeux, stands, buvette et spectacle des enfants.',
  'Cour de l''école élémentaire', 'fete', '2027-06-26', '10:00', '2027-06-26', '18:00', 0, 1,
  'u-admin', '2026-08-08T11:10:00.000Z', 'u-admin', '2026-08-08T11:10:00.000Z'),

 ('ev-10', 'Classe découverte des CM1-CM2',
  'Séjour de trois jours en Cévennes, financé en partie par les actions de l''association.',
  'Cévennes', 'sortie', '2027-05-17', NULL, '2027-05-19', NULL, 1, 1,
  'u-admin', '2026-08-08T11:20:00.000Z', 'u-admin', '2026-08-08T11:20:00.000Z');

INSERT INTO audit_log (created_at, actor_id, actor_email, actor_name, action, entity_type, entity_id, entity_label, changes, ip, user_agent) VALUES
 ('2026-08-05T10:00:00.000Z', 'u-admin', 'admin@apps-saussan.fr', 'Fabien Dupont', 'event.create', 'event', 'ev-1', 'Réunion de rentrée du bureau', '', '192.168.1.10', 'Mozilla/5.0'),
 ('2026-08-06T14:00:00.000Z', 'u-membre', 'membre@apps-saussan.fr', 'Camille Martin', 'event.create', 'event', 'ev-3', 'Vente de gâteaux à la sortie de l''école', '', '192.168.1.22', 'Mozilla/5.0'),
 ('2026-08-20T09:00:00.000Z', 'u-admin', 'admin@apps-saussan.fr', 'Fabien Dupont', 'user.create', 'user', 'u-invite', 'invite@apps-saussan.fr', '{"email":[null,"invite@apps-saussan.fr"],"role":[null,"membre"]}', '192.168.1.10', 'Mozilla/5.0'),
 ('2026-08-20T09:00:05.000Z', 'u-admin', 'admin@apps-saussan.fr', 'Fabien Dupont', 'user.activation_envoyee', 'user', 'u-invite', 'invite@apps-saussan.fr', '', '192.168.1.10', 'Mozilla/5.0');

INSERT INTO messages (id, name, email, subject, body, created_at, ip, read_at) VALUES
 ('msg-1', 'Julie Bertrand', 'julie.bertrand@example.com', 'Adhésion en cours d''année',
  'Bonjour,' || char(10) || char(10) || 'Nous venons d''emménager à Saussan et notre fille entre en CE1. Est-il possible d''adhérer à l''association en cours d''année ?' || char(10) || char(10) || 'Merci d''avance,' || char(10) || 'Julie',
  '2026-08-28T18:42:00.000Z', '82.64.12.9', NULL);
