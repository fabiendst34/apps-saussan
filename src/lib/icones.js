// Jeu d'icones dessinees, trait unique de 1.75, extremites arrondies :
// les memes courbes que le cartable du logo. Aucun emoji dans l'interface.

const TRACES = {
  horloge: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  lieu: '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
  cadenas: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  calendrier: '<rect x="3.5" y="5.5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3.5v4M16 3.5v4"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  coche: '<circle cx="12" cy="12" r="9"/><path d="m8.2 12.3 2.6 2.6 5-5.4"/>',
  alerte: '<path d="M12 4.5 2.9 20h18.2L12 4.5Z"/><path d="M12 10v4.2M12 17.2v.1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.1"/>',
  reglages: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 14.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.87 1.2v.17a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-2.93-1.16l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 3.5 14.5H3.3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.55 7.5l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.08A1.7 1.7 0 0 0 10.36 3.5V3.3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 2.87 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08a1.7 1.7 0 0 0 1.55 1.03h.17a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1.03Z"/>',
  enveloppe: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="m3.6 7 7.3 5.4a2 2 0 0 0 2.2 0L20.4 7"/>',
  personne: '<circle cx="12" cy="8" r="3.8"/><path d="M4.8 20.2a7.4 7.4 0 0 1 14.4 0"/>',
  personnes: '<circle cx="9.5" cy="8" r="3.4"/><path d="M3 20a6.7 6.7 0 0 1 13 0M16.2 4.8a3.4 3.4 0 0 1 0 6.5M18 20h3a5.6 5.6 0 0 0-2.8-4.8"/>',
  journal: '<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M8.5 8.5h7M8.5 12.5h7M8.5 16.5h4"/>',
  corbeille: '<path d="M4.5 7h15M9.5 7V5.2A1.7 1.7 0 0 1 11.2 3.5h1.6A1.7 1.7 0 0 1 14.5 5.2V7"/><path d="M6.5 7l.8 12.1a1.8 1.8 0 0 0 1.8 1.7h5.8a1.8 1.8 0 0 0 1.8-1.7L17.5 7"/>',
  crayon: '<path d="M15.9 4.6a2.3 2.3 0 0 1 3.3 3.2L8 19H4.8v-3.2Z"/><path d="m14.4 6.1 3.2 3.2"/>',
  fleche_gauche: '<path d="M14.5 6 8.5 12l6 6"/>',
  fleche_droite: '<path d="m9.5 6 6 6-6 6"/>',
  fleche_longue: '<path d="M4.5 12h14M13.5 7l5 5-5 5"/>',
  telecharger: '<path d="M12 3.8v10.4M7.6 10l4.4 4.3 4.4-4.3"/><path d="M4.5 17v1.8a1.7 1.7 0 0 0 1.7 1.7h11.6a1.7 1.7 0 0 0 1.7-1.7V17"/>',
  deconnexion: '<path d="M9.5 20.2H6a2 2 0 0 1-2-2V5.8a2 2 0 0 1 2-2h3.5"/><path d="M15 8.2 19 12l-4 3.8M19 12H9.5"/>',
  megaphone: '<path d="M4.5 10.2v3.6a1.6 1.6 0 0 0 1.6 1.6h1.7l7.4 4.3V4.3L7.8 8.6H6.1a1.6 1.6 0 0 0-1.6 1.6Z"/><path d="M18.6 9.2a4 4 0 0 1 0 5.6M7.8 15.4v3a1.6 1.6 0 0 0 1.6 1.6h.6"/>',
  guirlande: '<path d="M3 5.5c3.4 3.4 6.6 5 9 5s5.6-1.6 9-5"/><path d="m7.4 8.4-1.6 4.4a1.9 1.9 0 0 0 3.6 1.3l1.6-4.4M14.6 9.7l1.6 4.4a1.9 1.9 0 0 0 3.6-1.3l-1.6-4.4"/><path d="M12 10.5v9"/>',
  tirelire: '<path d="M20.5 12.6a6 6 0 0 0-4.3-5.4H9.6a6 6 0 0 0-4.4 4.2l-1.7 1v3.1l1.9.6a6 6 0 0 0 1.7 1.8v2.1h3v-1.3h4v1.3h3v-2.4a6 6 0 0 0 1.9-3.2l1.5-.5v-1.3Z"/><path d="M9.6 7.2A3.2 3.2 0 0 1 15 4.9M8.2 12.6v.1"/>',
  cartable: '<rect x="3.5" y="7.5" width="17" height="12.5" rx="3"/><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5"/><path d="M9.6 13.4a1.9 1.9 0 0 1 2.4-.6M14.4 13.4v.1"/>',
  epingle: '<path d="M9.2 3.5h5.6l-.8 5.6 3.5 3.2v1.6H6.5v-1.6l3.5-3.2Z"/><path d="M12 13.9v6.6"/>',
  recherche: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.5 15.5 4.5 4.5"/>',
  menu: '<path d="M4 7.5h16M4 12h16M4 16.5h16"/>',
  coche_simple: '<path d="m4.5 12.5 4.8 4.8L19.5 6.7"/>',
  fermer: '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>',
  outil: '<path d="M14.2 6.4a4.2 4.2 0 0 1 5.5 5.4l-1.6-1.6-2.3.6-.6-2.3Z"/><path d="m14.9 11.6-9 9a2 2 0 0 1-2.8-2.8l9-9"/>',
};

/**
 * Rend une icone.
 * @param {string} nom   cle du trace
 * @param {object} [o]
 * @param {number} [o.taille=20]
 * @param {string} [o.classe]
 * @param {string} [o.titre] libelle accessible ; sans lui l'icone est decorative
 */
export function icone(nom, o = {}) {
  const trace = TRACES[nom];
  if (!trace) return '';
  const { taille = 20, classe = '', titre = '' } = o;
  const acc = titre
    ? ` role="img" aria-label="${titre.replace(/"/g, '&quot;')}"`
    : ' aria-hidden="true" focusable="false"';
  return `<svg class="ico${classe ? ' ' + classe : ''}" width="${taille}" height="${taille}" viewBox="0 0 24 24"`
    + ` fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"${acc}>`
    + `${trace}</svg>`;
}

/** Icone associee a chaque categorie d'evenement. */
export const ICONE_CATEGORIE = {
  reunion: 'personnes',
  ecole: 'cartable',
  vente: 'tirelire',
  fete: 'guirlande',
  sortie: 'lieu',
  date_cle: 'epingle',
  autre: 'calendrier',
};
