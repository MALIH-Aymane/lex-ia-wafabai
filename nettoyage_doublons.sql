-- =====================================================================
-- Tache 2 : nettoyage des doublons de l'historique + correction du schema
-- Base : loimaroc (MariaDB, port 3307)
--
-- A executer dans l'ordre. Faire une sauvegarde avant l'etape 3 :
--   mariadb-dump -u root -P 3307 loimaroc > backup_avant_nettoyage.sql
-- =====================================================================


-- ---------------------------------------------------------------------
-- ETAPE 1 : DIAGNOSTIC (aucune modification, a lancer d'abord)
-- ---------------------------------------------------------------------

-- 1a. Combien de doublons exacts ?
SELECT
    `user`,
    LEFT(`texte`, 60) AS extrait,
    `status`,
    COUNT(*)          AS nb_occurrences,
    MIN(`id`)         AS id_conserve,
    GROUP_CONCAT(`id` ORDER BY `id`) AS tous_les_ids
FROM `questions`
GROUP BY `user`, `texte`, `status`
HAVING COUNT(*) > 1
ORDER BY nb_occurrences DESC;

-- 1b. Volume total concerne
SELECT
    COUNT(*) AS total_lignes,
    COUNT(DISTINCT CONCAT(`user`, '||', `texte`, '||', `status`)) AS lignes_uniques
FROM `questions`;

-- 1c. Questions referencees par une jurisprudence : elles ne seront JAMAIS
--     supprimees (contrainte jurisprudences_ibfk_1).
SELECT DISTINCT `question_id` FROM `jurisprudences` ORDER BY `question_id`;

-- 1d. Textes proches de la limite actuelle de 255 caracteres (tronques ?)
SELECT `id`, CHAR_LENGTH(`texte`) AS longueur, `texte`
FROM `questions`
WHERE CHAR_LENGTH(`texte`) >= 250
ORDER BY longueur DESC;


-- ---------------------------------------------------------------------
-- ETAPE 2 : CORRECTION DU SCHEMA
-- ---------------------------------------------------------------------

-- 2a. texte : varchar(255) -> TEXT (plus de troncature des questions longues)
ALTER TABLE `questions` MODIFY `texte` TEXT NULL;

-- 2b. Index sur (user, date) : la page Historique trie systematiquement
--     par utilisateur puis date decroissante.
CREATE INDEX `idx_questions_user_date` ON `questions` (`user`(191), `date`);

-- 2c. Correction de la valeur d'enum invalide (ligne 8 du dump : langue = '')
UPDATE `questions` SET `langue` = 'FR' WHERE `langue` = '' OR `langue` IS NULL;


-- ---------------------------------------------------------------------
-- ETAPE 3 : SUPPRESSION DES DOUBLONS EXISTANTS
-- Conserve la ligne la PLUS ANCIENNE de chaque groupe (MIN(id)),
-- protege toute question liee a une jurisprudence.
-- ---------------------------------------------------------------------

-- 3a. Verification prealable : liste exactement ce qui va disparaitre.
SELECT q.`id`, q.`user`, q.`date`, LEFT(q.`texte`, 60) AS extrait, q.`status`
FROM `questions` q
JOIN (
    SELECT `user`, `texte`, `status`, MIN(`id`) AS keep_id
    FROM `questions`
    GROUP BY `user`, `texte`, `status`
    HAVING COUNT(*) > 1
) d
  ON  q.`user`   = d.`user`
  AND q.`texte`  = d.`texte`
  AND q.`status` = d.`status`
WHERE q.`id` <> d.keep_id
  AND q.`id` NOT IN (SELECT `question_id` FROM `jurisprudences`)
ORDER BY q.`id`;

-- 3b. Suppression effective (a lancer seulement apres controle de 3a).
DELETE q FROM `questions` q
JOIN (
    SELECT `user`, `texte`, `status`, MIN(`id`) AS keep_id
    FROM `questions`
    GROUP BY `user`, `texte`, `status`
    HAVING COUNT(*) > 1
) d
  ON  q.`user`   = d.`user`
  AND q.`texte`  = d.`texte`
  AND q.`status` = d.`status`
WHERE q.`id` <> d.keep_id
  AND q.`id` NOT IN (SELECT `question_id` FROM `jurisprudences`);


-- ---------------------------------------------------------------------
-- ETAPE 4 : CONTROLE FINAL
-- ---------------------------------------------------------------------
SELECT COUNT(*) AS lignes_restantes FROM `questions`;

SELECT `user`, LEFT(`texte`, 60) AS extrait, `status`, COUNT(*) AS nb
FROM `questions`
GROUP BY `user`, `texte`, `status`
HAVING COUNT(*) > 1;
-- Ce dernier SELECT doit renvoyer 0 ligne, sauf pour les questions
-- protegees par une jurisprudence.
