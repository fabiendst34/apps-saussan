/**
 * Cree le tout premier compte administrateur.
 *
 * Il n'existe pas d'inscription libre sur le site : ce script produit les deux
 * requetes SQL a executer (le compte et son jeton d'activation) ainsi que le
 * lien d'activation a ouvrir dans le navigateur pour choisir le mot de passe.
 *
 * Usage :
 *   node scripts/premier-admin.mjs vous@exemple.fr "Prénom" "Nom" [--local]
 */

import { execFileSync } from 'node:child_process';

const [email, prenom = '', nom = ''] = process.argv.slice(2).filter((a) => a !== '--local');
const local = process.argv.includes('--local');

if (!email || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
  console.error('Usage : node scripts/premier-admin.mjs vous@exemple.fr "Prénom" "Nom" [--local]');
  process.exit(1);
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

const octets = new Uint8Array(32);
crypto.getRandomValues(octets);
const token = hex(octets);
const empreinte = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));

const id = crypto.randomUUID();
const maintenant = new Date().toISOString();
const expire = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
const q = (s) => String(s).replace(/'/g, "''");

const sql = [
  `INSERT INTO users (id, email, first_name, last_name, role, status, title, phone, created_at, updated_at)`,
  `VALUES ('${id}', '${q(email.toLowerCase())}', '${q(prenom)}', '${q(nom)}', 'admin', 'invite', '', '', '${maintenant}', '${maintenant}');`,
  `INSERT INTO tokens (id, user_id, kind, created_at, expires_at)`,
  `VALUES ('${empreinte}', '${id}', 'activation', '${maintenant}', '${expire}');`,
].join('\n');

console.log('\n--- SQL a executer ---\n');
console.log(sql);

const cible = local ? '--local' : '--remote';
console.log(`\n--- Commande ---\n`);
console.log(`npx wrangler d1 execute apps-saussan ${cible} --command "${sql.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`);

const base = local ? 'http://localhost:8787' : (process.env.SITE_URL || 'https://VOTRE-DOMAINE');
console.log(`\n--- Lien d'activation (valable 7 jours, a usage unique) ---\n`);
console.log(`${base}/espace/activation?token=${token}\n`);
console.log("Executez d'abord le SQL, puis ouvrez ce lien pour choisir votre mot de passe.\n");
