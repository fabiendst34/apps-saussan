// Authentification : hachage des mots de passe, sessions, CSRF, jetons a usage unique.
import { randomToken, sha256, safeEqual, nowIso, isoPlus, uuid, clientIp, userAgent } from './util.js';

const COOKIE_NAME = 'apps_session';
const SESSION_TTL = 60 * 60 * 24 * 30;        // 30 jours
const ACTIVATION_TTL = 60 * 60 * 24 * 7;       // 7 jours
const RESET_TTL = 60 * 60 * 2;                 // 2 heures

/**
 * Nombre d'iterations PBKDF2, pilote par la variable PBKDF2_ITERATIONS.
 *
 * Le plan Workers gratuit limite chaque requete a 10 ms de CPU, or PBKDF2-SHA256
 * coute environ 1 ms pour 10 000 iterations : au-dela de ~60 000, la connexion
 * echouerait avec « exceeded CPU time limit ». Sur le plan payant (5 $/mois) la
 * limite passe a 30 s, on peut alors viser les 210 000 iterations recommandees.
 *
 * Le nombre d'iterations est inscrit dans chaque empreinte : changer cette valeur
 * n'invalide aucun mot de passe existant, elle ne vaut que pour les suivants.
 */
function iterationsPbkdf2(env) {
  const n = parseInt(env?.PBKDF2_ITERATIONS, 10);
  return Number.isFinite(n) && n >= 10_000 ? n : 50_000;
}

// --- Mots de passe ---------------------------------------------------

function b64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function unb64(text) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

export async function hashPassword(password, env) {
  const iter = iterationsPbkdf2(env);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(password, salt, iter);
  return `pbkdf2$${iter}$${b64(salt)}$${b64(bits)}`;
}

export async function verifyPassword(password, stored) {
  if (!stored) return false;
  const [scheme, iterations, salt, expected] = String(stored).split('$');
  if (scheme !== 'pbkdf2') return false;
  const bits = await derive(password, unb64(salt), Number(iterations));
  return safeEqual(b64(bits), expected);
}

/** Regles minimales : 10 caracteres, au moins une lettre et un chiffre. */
export function passwordProblem(password) {
  if (password.length < 10) return 'Le mot de passe doit contenir au moins 10 caractères.';
  if (!/[a-zA-Z]/.test(password)) return 'Le mot de passe doit contenir au moins une lettre.';
  if (!/[0-9]/.test(password)) return 'Le mot de passe doit contenir au moins un chiffre.';
  if (password.length > 200) return 'Le mot de passe est trop long.';
  return null;
}

// --- Sessions --------------------------------------------------------

function cookieHeader(value, maxAge, url) {
  const secure = url.protocol === 'https:' ? ' Secure;' : '';
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${maxAge}`;
}

export function readCookie(request) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE_NAME) return rest.join('=');
  }
  return null;
}

export async function createSession(env, request, url, userId) {
  const token = randomToken(32);
  const id = await sha256(token);
  const csrf = randomToken(24);
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, csrf_token, created_at, expires_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, userId, csrf, nowIso(), isoPlus(SESSION_TTL), clientIp(request), userAgent(request)).run();

  await env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(nowIso(), userId).run();
  return { 'set-cookie': cookieHeader(token, SESSION_TTL, url) };
}

export async function destroySession(env, request, url) {
  const token = readCookie(request);
  if (token) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256(token)).run();
  }
  return { 'set-cookie': cookieHeader('', 0, url) };
}

/** Supprime toutes les sessions d'un compte (suspension, suppression, changement de mot de passe). */
export async function destroyUserSessions(env, userId) {
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
}

/** Retourne { user, session } ou null. Nettoie au passage les sessions expirees. */
export async function currentUser(env, request) {
  const token = readCookie(request);
  if (!token) return null;
  const id = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT s.id AS session_id, s.csrf_token, s.expires_at, u.*
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ?`
  ).bind(id).first();

  if (!row) return null;
  if (row.expires_at < nowIso() || row.status !== 'actif') {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
    return null;
  }
  const { session_id, csrf_token, expires_at, ...user } = row;
  return { user, session: { id: session_id, csrf: csrf_token, expiresAt: expires_at } };
}

/** Verifie le jeton CSRF d'un formulaire. */
export function checkCsrf(session, form) {
  return !!session && safeEqual(String(form.get('csrf') || ''), session.csrf);
}

// --- Jetons a usage unique ------------------------------------------

export async function issueToken(env, userId, kind) {
  const token = randomToken(32);
  const ttl = kind === 'activation' ? ACTIVATION_TTL : RESET_TTL;
  // Un seul jeton valide a la fois par usage : les precedents sont revoques.
  await env.DB.prepare('DELETE FROM tokens WHERE user_id = ? AND kind = ?').bind(userId, kind).run();
  await env.DB.prepare(
    'INSERT INTO tokens (id, user_id, kind, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(await sha256(token), userId, kind, nowIso(), isoPlus(ttl)).run();
  return token;
}

export async function consumeToken(env, token, kind) {
  if (!token) return null;
  const id = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT t.*, u.email, u.first_name, u.last_name, u.status
       FROM tokens t JOIN users u ON u.id = t.user_id
      WHERE t.id = ? AND t.kind = ?`
  ).bind(id, kind).first();

  if (!row || row.used_at || row.expires_at < nowIso()) return null;
  return { tokenId: id, ...row };
}

export async function markTokenUsed(env, tokenId) {
  await env.DB.prepare('UPDATE tokens SET used_at = ? WHERE id = ?').bind(nowIso(), tokenId).run();
}

// --- Limitation des tentatives de connexion --------------------------

/**
 * Bloque au-dela de 8 echecs pour un meme couple IP/email sur 15 minutes.
 * S'appuie sur le journal d'audit : pas de table supplementaire a purger.
 */
export async function tooManyAttempts(env, ip, email) {
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM audit_log
      WHERE action = 'auth.echec' AND created_at > ?
        AND (ip = ? OR actor_email = ?)`
  ).bind(since, ip || '—', email || '—').first();
  return (row?.n || 0) >= 8;
}
