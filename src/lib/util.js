// Utilitaires transverses : echappement, dates, identifiants, reponses HTTP.

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Echappe toute valeur destinee a etre injectee dans du HTML. */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/** Transforme un texte libre en HTML : echappement + sauts de ligne + liens. */
export function richText(value) {
  const safe = esc(value).replace(/\r\n/g, '\n');
  return safe
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function uuid() {
  return crypto.randomUUID();
}

/** Jeton URL-safe pour les cookies de session et les liens d'activation. */
export function randomToken(bytes = 32) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparaison a temps constant, pour les jetons CSRF et les empreintes. */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function nowIso() {
  return new Date().toISOString();
}

export function isoPlus(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

// --- Dates -----------------------------------------------------------

const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
const MOIS_ACC = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export const MOIS_NOMS = MOIS_ACC;
export const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
/** Abreviations d'usage en francais : « sept. », « oct. », mais « mai » et « juin » en entier. */
export const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** 'AAAA-MM-JJ' -> Date en heure locale (evite le decalage UTC de new Date('...')). */
export function parseDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayKey() {
  return toDateKey(new Date());
}

/** '2026-09-14' -> 'Lundi 14 septembre 2026' */
export function formatDateLong(iso) {
  const d = parseDate(iso);
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

/** '2026-09-14' -> '14 sept. 2026' */
export function formatDateShort(iso) {
  const d = parseDate(iso);
  return `${d.getDate()} ${MOIS_COURTS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Horodatage d'audit : '14/09/2026 à 18:32' */
export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} à ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Resume lisible d'un creneau : « Sam. 4 oct. 2026, 14:00 → 18:00 ». */
export function formatRange(ev) {
  const sameDay = ev.start_date === ev.end_date;
  if (ev.all_day) {
    return sameDay
      ? formatDateLong(ev.start_date)
      : `Du ${formatDateShort(ev.start_date)} au ${formatDateShort(ev.end_date)}`;
  }
  if (sameDay) {
    const fin = ev.end_time && ev.end_time !== ev.start_time ? ` → ${ev.end_time}` : '';
    return `${formatDateLong(ev.start_date)}, ${ev.start_time || ''}${fin}`;
  }
  return `Du ${formatDateShort(ev.start_date)} ${ev.start_time || ''} au ${formatDateShort(ev.end_date)} ${ev.end_time || ''}`;
}

// --- Reponses HTTP ---------------------------------------------------

export function html(body, init = {}) {
  return new Response(body, {
    ...init,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      ...(init.headers || {}),
    },
  });
}

export function redirect(location, extraHeaders = {}) {
  return new Response(null, { status: 302, headers: { location, ...extraHeaders } });
}

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', ...(init.headers || {}) },
  });
}

/** Ajoute des parametres de requete a un chemin (pour les redirections avec message). */
export function withQuery(path, params) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return qs ? `${path}?${qs}` : path;
}

export function clientIp(request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
}

export function userAgent(request) {
  return (request.headers.get('user-agent') || '').slice(0, 250);
}

/** Nettoie une chaine issue d'un formulaire. */
export function field(form, name, max = 500) {
  return String(form.get(name) ?? '').trim().slice(0, max);
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value);
}

export function fullName(user) {
  if (!user) return '';
  const n = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  return n || user.email || '';
}

export function initials(user) {
  const a = (user?.first_name || user?.email || '?').trim()[0] || '?';
  const b = (user?.last_name || '').trim()[0] || '';
  return (a + b).toUpperCase();
}
