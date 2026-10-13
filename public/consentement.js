/* Consentement a la mesure d'audience, et chargement de Google Analytics.

   Rien de Google n'est charge avant l'accord du visiteur : pas de script, pas
   de cookie, pas meme une requete. La CNIL ne dispense pas Google Analytics de
   consentement, et le mode « refuse » de Google enverrait quand meme des
   signaux a ses serveurs.

   Accepter et refuser pesent le meme poids a l'ecran, comme l'exige la CNIL, et
   le lien « Cookies » du pied de page permet de revenir sur son choix.

   Ce fichier n'est servi que sur les pages publiques : le gabarit ne l'inclut
   pas dans l'espace membres ni dans l'administration. Ce que fait un parent
   connecte ne regarde pas Google. */

(() => {
  const ID_MESURE = 'G-LPEJ099J18';
  const CLE = 'apps-consentement';
  /* Le choix est redemande au bout de six mois, duree recommandee par la CNIL. */
  const DUREE_CHOIX_MS = 182 * 24 * 60 * 60 * 1000;
  /* Les cookies de Google vivent deux ans par defaut ; la CNIL plafonne a treize mois. */
  const DUREE_COOKIES_S = 395 * 24 * 60 * 60;

  /* La mesure ne vaut que pour le site en ligne : le poste de developpement ne
     doit pas gonfler les chiffres de l'association. */
  const enProduction = location.hostname === 'apps-saussan.fr'
    || location.hostname === 'www.apps-saussan.fr';

  function lireChoix() {
    try {
      const choix = JSON.parse(localStorage.getItem(CLE) || 'null');
      if (!choix || (choix.valeur !== 'accepte' && choix.valeur !== 'refuse')) return null;
      if (Date.now() - choix.le > DUREE_CHOIX_MS) return null;
      return choix.valeur;
    } catch {
      return null;
    }
  }

  function enregistrerChoix(valeur) {
    try {
      localStorage.setItem(CLE, JSON.stringify({ valeur, le: Date.now() }));
    } catch {
      /* Navigation privee stricte : le choix ne vaut que pour cette page. */
    }
  }

  let chargee = false;

  function chargerMesure() {
    if (chargee || !enProduction) return;
    chargee = true;
    window['ga-disable-' + ID_MESURE] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', ID_MESURE, { cookie_expires: DUREE_COOKIES_S });

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID_MESURE;
    document.head.appendChild(script);
  }

  function arreterMesure() {
    /* Coupe les envois de la page en cours, puis efface les cookies deja poses :
       retirer son accord doit avoir le meme effet que ne l'avoir jamais donne. */
    window['ga-disable-' + ID_MESURE] = true;
    for (const entree of document.cookie.split(';')) {
      const nom = entree.split('=')[0].trim();
      if (nom !== '_ga' && !nom.startsWith('_ga_')) continue;
      for (const domaine of ['', '; domain=' + location.hostname, '; domain=.apps-saussan.fr']) {
        document.cookie = nom + '=; Max-Age=0; path=/' + domaine;
      }
    }
  }

  let bandeau = null;

  function choisir(valeur) {
    enregistrerChoix(valeur);
    if (valeur === 'accepte') chargerMesure(); else arreterMesure();
    if (bandeau) bandeau.hidden = true;
  }

  function ouvrirBandeau() {
    if (!bandeau) {
      bandeau = document.createElement('section');
      bandeau.className = 'consentement';
      bandeau.setAttribute('aria-label', "Mesure d'audience");
      bandeau.innerHTML = `
        <p class="consentement__texte">
          <strong>Mesure d'audience.</strong> Avec votre accord, l'association utilise Google
          Analytics pour savoir combien de personnes visitent le site et quelles pages les
          intéressent. Aucune publicité, et rien de ce que vous faites dans l'espace membres.
          <a href="/confidentialite#cookies">En savoir plus</a>
        </p>
        <div class="consentement__actions">
          <button type="button" class="btn btn--principal btn--petit" data-choix="refuse">Refuser</button>
          <button type="button" class="btn btn--principal btn--petit" data-choix="accepte">Accepter</button>
        </div>`;
      bandeau.addEventListener('click', (e) => {
        const bouton = e.target.closest('[data-choix]');
        if (bouton) choisir(bouton.dataset.choix);
      });
      document.body.appendChild(bandeau);
    }
    bandeau.hidden = false;
  }

  /* Le lien « Cookies » du pied de page rouvre le bandeau. */
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-gerer-cookies]')) {
      e.preventDefault();
      ouvrirBandeau();
    }
  });

  const choix = lireChoix();
  if (choix === 'accepte') chargerMesure();
  else if (choix === null) ouvrirBandeau();
})();
