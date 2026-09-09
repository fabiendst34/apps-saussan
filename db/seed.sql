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
DELETE FROM articles;
DELETE FROM medias;
DELETE FROM messages;
DELETE FROM tokens;
DELETE FROM sessions;
DELETE FROM event_leaders;
DELETE FROM events;
DELETE FROM users;

INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, instance, title, phone, created_at, updated_at) VALUES
 ('u-admin',  'admin@apps-saussan.fr',
  'pbkdf2$50000$SoxBkQmU+OVW1ZFKaDI/oA==$S6W2dj9AujIkcU9Liv+RbpOMITmDm+5lG+ZQMuVZxSg=',
  'Fabien', 'Dupont', 'admin', 'actif', 'bureau', 'Vice-président', '', '2026-08-01T09:00:00.000Z', '2026-08-01T09:00:00.000Z'),
 ('u-membre', 'membre@apps-saussan.fr',
  'pbkdf2$50000$SoxBkQmU+OVW1ZFKaDI/oA==$S6W2dj9AujIkcU9Liv+RbpOMITmDm+5lG+ZQMuVZxSg=',
  'Camille', 'Martin', 'membre', 'actif', 'ca', 'Trésorière', '', '2026-08-02T09:00:00.000Z', '2026-08-02T09:00:00.000Z'),
 ('u-invite', 'invite@apps-saussan.fr', NULL,
  'Sofia', 'Nguyen', 'membre', 'invite', 'membre', '', '', '2026-08-20T09:00:00.000Z', '2026-08-20T09:00:00.000Z');

INSERT INTO events (id, title, description, location, category, audience, start_date, start_time, end_date, end_time,
                    all_day, is_public, created_by, created_at, updated_by, updated_at) VALUES
 ('ev-1', 'Réunion de rentrée du bureau',
  'Ordre du jour : bilan de l''année écoulée, calendrier des actions, répartition des rôles.',
  'Centre Socio-culturel', 'reunion', 'bureau', '2026-09-08', '20:30', '2026-09-08', '22:00', 0, 0,
  'u-admin', '2026-08-05T10:00:00.000Z', 'u-admin', '2026-08-05T10:00:00.000Z'),

 ('ev-2', 'Assemblée générale annuelle',
  'Présentation du bilan moral et financier, vote du budget et élection du nouveau bureau. Ouverte à toutes les familles adhérentes.',
  'Salle polyvalente de Saussan', 'reunion', 'tous', '2026-09-26', '18:30', '2026-09-26', '20:30', 0, 1,
  'u-admin', '2026-08-05T10:05:00.000Z', 'u-admin', '2026-08-05T10:05:00.000Z'),

 ('ev-3', 'Vente de gâteaux à la sortie de l''école',
  'Vente au profit des sorties scolaires. Les parents volontaires peuvent déposer leurs gâteaux le matin.',
  'Devant l''école élémentaire', 'vente', 'tous', '2026-10-09', '16:15', '2026-10-09', '17:30', 0, 1,
  'u-membre', '2026-08-06T14:00:00.000Z', 'u-membre', '2026-08-06T14:00:00.000Z'),

 ('ev-4', 'Halloween des Pitchouns',
  'Défilé costumé dans le village suivi d''un goûter. Rendez-vous devant la mairie.',
  'Place de la Fontaine', 'fete', 'tous', '2026-10-31', '17:00', '2026-10-31', '19:30', 0, 1,
  'u-membre', '2026-08-06T14:10:00.000Z', 'u-membre', '2026-08-06T14:10:00.000Z'),

 ('ev-5', 'Préparation du marché de Noël',
  'Confection des décorations et mise en sachet des chocolats. Toutes les bonnes volontés sont bienvenues.',
  'Centre Socio-culturel', 'ecole', 'tous', '2026-11-21', '14:00', '2026-11-21', '18:00', 0, 0,
  'u-admin', '2026-08-07T09:30:00.000Z', 'u-admin', '2026-08-07T09:30:00.000Z'),

 ('ev-6', 'Marché de Noël de l''école',
  'Stands des enfants, vin chaud, crêpes et tombola. Les bénéfices financent la classe découverte des CM.',
  'Cour de l''école élémentaire', 'fete', 'tous', '2026-12-12', '10:00', '2026-12-12', '17:00', 0, 1,
  'u-admin', '2026-08-07T09:35:00.000Z', 'u-admin', '2026-08-07T09:35:00.000Z'),

 ('ev-7', 'Conseil d''école — 1er trimestre',
  'Représentation des parents élus. Points à remonter : cantine, périscolaire, travaux de la cour.',
  'École élémentaire', 'reunion', 'ca', '2026-11-13', '18:00', '2026-11-13', '20:00', 0, 0,
  'u-admin', '2026-08-07T09:40:00.000Z', 'u-admin', '2026-08-07T09:40:00.000Z'),

 ('ev-8', 'Carnaval de Saussan',
  'Défilé costumé dans les rues du village avec la fanfare, puis bataille de confettis sur la place.',
  'Village de Saussan', 'fete', 'tous', '2027-03-20', NULL, '2027-03-20', NULL, 1, 1,
  'u-membre', '2026-08-08T11:00:00.000Z', 'u-membre', '2026-08-08T11:00:00.000Z'),

 ('ev-9', 'Kermesse de fin d''année',
  'La grande fête de l''année : jeux, stands, buvette et spectacle des enfants.',
  'Cour de l''école élémentaire', 'fete', 'tous', '2027-06-26', '10:00', '2027-06-26', '18:00', 0, 1,
  'u-admin', '2026-08-08T11:10:00.000Z', 'u-admin', '2026-08-08T11:10:00.000Z'),

 ('ev-11', 'Date limite d''inscription au séjour en Cévennes',
  'Dernier jour pour rendre le dossier et le règlement au bureau. Aucun dossier ne sera accepté après cette date.',
  '', 'date_cle', 'tous', '2027-02-27', NULL, '2027-02-27', NULL, 1, 1,
  'u-admin', '2026-08-08T11:30:00.000Z', 'u-admin', '2026-08-08T11:30:00.000Z'),

 ('ev-12', 'Dépôt du dossier de subvention en mairie',
  'Échéance administrative : le dossier doit être déposé au secrétariat avant la fermeture.',
  '', 'date_cle', 'bureau', '2026-10-15', NULL, '2026-10-15', NULL, 1, 0,
  'u-admin', '2026-08-08T11:35:00.000Z', 'u-admin', '2026-08-08T11:35:00.000Z'),

 ('ev-10', 'Classe découverte des CM1-CM2',
  'Séjour de trois jours en Cévennes, financé en partie par les actions de l''association.',
  'Cévennes', 'sortie', 'tous', '2027-05-17', NULL, '2027-05-19', NULL, 1, 1,
  'u-admin', '2026-08-08T11:20:00.000Z', 'u-admin', '2026-08-08T11:20:00.000Z');

-- Equipes de leaders : qui porte quoi.
INSERT INTO event_leaders (event_id, user_id) VALUES
 ('ev-4',  'u-membre'),
 ('ev-6',  'u-admin'),
 ('ev-6',  'u-membre'),
 ('ev-9',  'u-membre'),
 ('ev-12', 'u-admin');

INSERT INTO audit_log (created_at, actor_id, actor_email, actor_name, action, entity_type, entity_id, entity_label, changes, ip, user_agent) VALUES
 ('2026-08-05T10:00:00.000Z', 'u-admin', 'admin@apps-saussan.fr', 'Fabien Dupont', 'event.create', 'event', 'ev-1', 'Réunion de rentrée du bureau', '', '192.168.1.10', 'Mozilla/5.0'),
 ('2026-08-06T14:00:00.000Z', 'u-membre', 'membre@apps-saussan.fr', 'Camille Martin', 'event.create', 'event', 'ev-3', 'Vente de gâteaux à la sortie de l''école', '', '192.168.1.22', 'Mozilla/5.0'),
 ('2026-08-20T09:00:00.000Z', 'u-admin', 'admin@apps-saussan.fr', 'Fabien Dupont', 'user.create', 'user', 'u-invite', 'invite@apps-saussan.fr', '{"email":[null,"invite@apps-saussan.fr"],"role":[null,"membre"]}', '192.168.1.10', 'Mozilla/5.0'),
 ('2026-08-20T09:00:05.000Z', 'u-admin', 'admin@apps-saussan.fr', 'Fabien Dupont', 'user.activation_envoyee', 'user', 'u-invite', 'invite@apps-saussan.fr', '', '192.168.1.10', 'Mozilla/5.0');

INSERT INTO messages (id, name, email, subject, body, created_at, ip, read_at) VALUES
 ('msg-1', 'Julie Bertrand', 'julie.bertrand@example.com', 'Adhésion en cours d''année',
  'Bonjour,' || char(10) || char(10) || 'Nous venons d''emménager à Saussan et notre fille entre en CE1. Est-il possible d''adhérer à l''association en cours d''année ?' || char(10) || char(10) || 'Merci d''avance,' || char(10) || 'Julie',
  '2026-08-28T18:42:00.000Z', '82.64.12.9', NULL);

-- Articles de demonstration. Sans image : le gabarit affiche alors une
-- vignette de repli, ce qui permet de voir aussi cet etat.
INSERT INTO articles (id, slug, title, chapo, body, image_id, image_alt, status, is_featured,
                      published_at, created_by, created_at, updated_by, updated_at) VALUES
 ('ar-1', 'le-marche-de-noel-a-rapporte-1240-euros',
  'Le marché de Noël a rapporté 1 240 €',
  'Merci aux 40 familles venues tenir les stands : la classe découverte des CM est financée.',
  '## Une réussite collective' || char(10) || char(10) ||
  'Le marché de Noël s''est tenu **samedi 12 décembre** dans la cour de l''école élémentaire, sous un soleil inespéré.' || char(10) || char(10) ||
  '- 18 stands tenus par les enfants' || char(10) ||
  '- 240 crêpes vendues' || char(10) ||
  '- 1 240 € de bénéfice' || char(10) || char(10) ||
  'L''essentiel de cette somme part vers la classe découverte des CM1-CM2 en Cévennes, au mois de mai.' || char(10) || char(10) ||
  'Un grand merci à *toutes les familles* qui ont donné de leur temps, prêté du matériel ou simplement fait un tour.',
  NULL, '', 'publie', 1, '2026-08-25T10:00:00.000Z',
  'u-admin', '2026-08-25T09:30:00.000Z', 'u-admin', '2026-08-25T10:00:00.000Z'),

 ('ar-2', 'rentree-2026-ce-qui-change-a-la-cantine',
  'Rentrée 2026 : ce qui change à la cantine',
  'Nouveau prestataire, menus affichés à l''avance et une commission repas ouverte aux parents.',
  'La mairie a retenu un nouveau prestataire pour la restauration scolaire à compter de septembre.' || char(10) || char(10) ||
  '## Les menus à l''avance' || char(10) || char(10) ||
  'Les menus seront désormais affichés quatre semaines à l''avance, à l''entrée des deux écoles et sur le panneau du centre socio-culturel.' || char(10) || char(10) ||
  '## Une commission ouverte aux parents' || char(10) || char(10) ||
  'Une commission repas se réunira chaque trimestre. Deux places y sont réservées aux parents d''élèves : faites-vous connaître auprès du bureau si le sujet vous intéresse.',
  NULL, '', 'publie', 1, '2026-08-20T08:00:00.000Z',
  'u-membre', '2026-08-19T20:15:00.000Z', 'u-membre', '2026-08-20T08:00:00.000Z'),

 ('ar-3', 'appel-a-benevoles-pour-la-kermesse',
  'Appel à bénévoles pour la kermesse',
  'Une heure de votre temps suffit : il reste des créneaux sur les stands et à la buvette.',
  'La kermesse de fin d''année se prépare et nous cherchons des bras.' || char(10) || char(10) ||
  '- Tenue des stands de jeux, par créneaux d''une heure' || char(10) ||
  '- Buvette et crêpes' || char(10) ||
  '- Montage le vendredi soir, démontage le samedi en fin de journée' || char(10) || char(10) ||
  'Aucune compétence particulière n''est requise, et vous n''êtes engagé que sur le créneau choisi. Écrivez-nous pour vous inscrire.',
  NULL, '', 'publie', 0, '2026-08-10T17:30:00.000Z',
  'u-membre', '2026-08-10T17:00:00.000Z', 'u-membre', '2026-08-10T17:30:00.000Z'),

 ('ar-4', 'compte-rendu-du-conseil-d-ecole',
  'Compte rendu du conseil d''école — brouillon',
  'À relire par le bureau avant publication.',
  'Points abordés : effectifs, travaux de la cour, projet piscine.',
  NULL, '', 'brouillon', 0, NULL,
  'u-admin', '2026-08-28T21:00:00.000Z', 'u-admin', '2026-08-28T21:00:00.000Z');

INSERT INTO audit_log (created_at, actor_id, actor_email, actor_name, action, entity_type, entity_id, entity_label, changes, ip, user_agent) VALUES
 ('2026-08-25T09:30:00.000Z', 'u-admin', 'admin@apps-saussan.fr', 'Fabien Dupont', 'article.create', 'article', 'ar-1', 'Le marché de Noël a rapporté 1 240 €', '', '192.168.1.10', 'Mozilla/5.0'),
 ('2026-08-20T08:00:00.000Z', 'u-membre', 'membre@apps-saussan.fr', 'Camille Martin', 'article.update', 'article', 'ar-2', 'Rentrée 2026 : ce qui change à la cantine', '{"status":["brouillon","publie"]}', '192.168.1.22', 'Mozilla/5.0');
