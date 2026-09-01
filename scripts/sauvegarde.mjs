/**
 * Exporte la base de production dans un fichier daté.
 *
 * D1 sait revenir en arriere de lui-meme, mais uniquement a l'interieur de
 * Cloudflare : si le compte devenait inaccessible, l'association perdrait son
 * calendrier, ses comptes et ses articles. Cette sauvegarde vit ailleurs.
 *
 * Usage :
 *   node scripts/sauvegarde.mjs             -> sauvegardes/apps-saussan-AAAA-MM-JJ.sql
 *   node scripts/sauvegarde.mjs --local     -> depuis la base de developpement
 *   node scripts/sauvegarde.mjs --sortie D:/chemin
 *
 * Les images des articles sont volumineuses : elles ne sont incluses qu'avec
 * --avec-images, une sauvegarde hebdomadaire suffisant a leur sujet.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const local = args.includes('--local');
const avecImages = args.includes('--avec-images');
const iSortie = args.indexOf('--sortie');
const dossier = iSortie !== -1 ? args[iSortie + 1] : 'sauvegardes';

const TABLES = ['users', 'events', 'articles', 'messages', 'settings', 'audit_log'];
if (avecImages) TABLES.push('medias');

// Wrangler est appele par son point d'entree Node plutot que par `npx` : sous
// Windows, passer par le shell decouperait la requete SQL sur ses espaces.
const WRANGLER = new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url).pathname.replace(/^\//, '');

function requete(sql) {
  const sortie = execFileSync(process.execPath, [
    WRANGLER, 'd1', 'execute', 'apps-saussan',
    local ? '--local' : '--remote', '--json', '--command', sql,
  ], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

  // wrangler prefixe parfois le JSON de lignes d'information.
  const debut = sortie.indexOf('[');
  return JSON.parse(sortie.slice(debut))[0].results;
}

function litteral(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return `X'${v.map((o) => o.toString(16).padStart(2, '0')).join('')}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

const jour = new Date().toISOString().slice(0, 10);
mkdirSync(dossier, { recursive: true });

const morceaux = [
  `-- Sauvegarde APPS Saussan — ${new Date().toISOString()}`,
  `-- Source : base ${local ? 'locale' : 'de production'}${avecImages ? ', images comprises' : ', sans les images'}`,
  '-- Restauration : wrangler d1 execute apps-saussan --remote --file=<ce fichier>',
  'PRAGMA defer_foreign_keys = true;',
  '',
];

let totalLignes = 0;
for (const table of TABLES) {
  let lignes;
  try {
    lignes = requete(`SELECT * FROM ${table}`);
  } catch (err) {
    console.error(`  ${table.padEnd(12)} ignorée (${String(err.message).split('\n')[0]})`);
    continue;
  }
  console.log(`  ${table.padEnd(12)} ${String(lignes.length).padStart(5)} ligne(s)`);
  totalLignes += lignes.length;
  if (!lignes.length) continue;

  morceaux.push(`-- ${table}`);
  morceaux.push(`DELETE FROM ${table};`);
  const colonnes = Object.keys(lignes[0]);
  for (const ligne of lignes) {
    const valeurs = colonnes.map((c) => litteral(ligne[c])).join(', ');
    morceaux.push(`INSERT INTO ${table} (${colonnes.join(', ')}) VALUES (${valeurs});`);
  }
  morceaux.push('');
}

const chemin = join(dossier, `apps-saussan-${jour}${avecImages ? '-images' : ''}.sql`);
writeFileSync(chemin, morceaux.join('\n'), 'utf8');
console.log(`\n${totalLignes} ligne(s) écrite(s) dans ${chemin}`);
if (!avecImages) console.log('Les images ne sont pas incluses : relancer avec --avec-images pour les ajouter.');
