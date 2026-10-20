---
name: APPS Saussan
description: Site d'une association de parents d'élèves — jaune soleil, noir d'ardoise, crème et typographies rondes d'école.
colors:
  jaune: "#F2A93B"
  jaune-fonce: "#C88512"
  jaune-pale: "#FDEBC8"
  jaune-voile: "#FEF6E7"
  noir: "#1D1B19"
  encre: "#322E2A"
  gris: "#6B6257"
  gris-clair: "#9A9086"
  creme: "#FBF7F0"
  blanc: "#FFFFFF"
  bord: "#EBE2D4"
  bord-fort: "#DCCFB9"
  vert: "#2E8B62"
  vert-pale: "#E4F4EB"
  rouge: "#C0392F"
  rouge-pale: "#FBEAE8"
  bleu: "#2C6E9B"
  bleu-pale: "#E5F0F7"
  violet: "#7A5AA8"
  violet-pale: "#F0EAF8"
typography:
  display:
    fontFamily: "'Baloo 2', Nunito, sans-serif"
    fontSize: "clamp(2rem, 1.4rem + 2.4vw, 3.1rem)"
    fontWeight: 700
    letterSpacing: "-0.5px"
  headline:
    fontFamily: "'Baloo 2', Nunito, sans-serif"
    fontSize: "clamp(1.5rem, 1.2rem + 1.2vw, 2.1rem)"
    fontWeight: 700
  title:
    fontFamily: "'Baloo 2', Nunito, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
  marque:
    fontFamily: "'Baloo 2', sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
  body:
    fontFamily: "Nunito, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "16.5px"
    fontWeight: 400
  button:
    fontFamily: "Nunito, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 800
rounded:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "20px"
  xl: "28px"
  pill: "999px"
spacing:
  contenu: "1120px"
components:
  button-principal:
    backgroundColor: "{colors.noir}"
    textColor: "{colors.jaune}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0.7rem 1.4rem"
  button-jaune:
    backgroundColor: "{colors.jaune}"
    textColor: "{colors.noir}"
    rounded: "{rounded.pill}"
    padding: "0.7rem 1.4rem"
  button-fantome:
    backgroundColor: "transparent"
    textColor: "{colors.noir}"
    rounded: "{rounded.pill}"
  button-danger:
    backgroundColor: "{colors.rouge-pale}"
    textColor: "{colors.rouge}"
    rounded: "{rounded.pill}"
  carte:
    backgroundColor: "{colors.blanc}"
    textColor: "{colors.encre}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
---

# Design System: APPS Saussan

## Overview

**Creative North Star: "Le cartable et le tableau noir"**

Une association de parents, chaleureuse et efficace. Le jaune soleil (cartable, crayon) et le noir d'ardoise forment le couple de marque : le bouton principal est un rectangle noir arrondi au texte jaune, comme une craie sur un tableau. Le fond crème adoucit l'ensemble. Baloo 2, ronde et épaisse, donne la voix enfantine aux titres ; Nunito, ronde elle aussi, reste parfaitement lisible pour l'interface.

Le même système sert le site public et l'espace membres (`styles-app.css`) : les membres retrouvent les composants du site.

**Key Characteristics:**
- Couple noir / jaune pour l'action, jaune pâle pour les survols.
- Deux polices rondes : Baloo 2 pour les titres, Nunito pour le reste.
- Tout en pilule pour les boutons, cartes à 20 px.
- Palette de catégories pour le calendrier, toujours en paire « teinte + fond pâle ».
- Trois niveaux d'ombre douce teintée de brun.

## Colors

### Primary
- **Jaune** (jaune) : bouton jaune, texte du bouton principal, étiquettes, bordure au survol des boutons fantômes. Survol **Jaune foncé** (jaune-fonce).
- **Noir ardoise** (noir) : fond du bouton principal et des étiquettes noires.
- **Jaune pâle** et **Jaune voile** : survols et fonds de mise en avant.

### Secondary (sémantique et catégories)
- **Vert**, **Rouge**, **Bleu**, **Violet**, chacun avec sa version pâle : états (succès, erreur, information) et catégories d'événements.
- Les catégories du calendrier définissent `--cat` / `--cat-pale` : bleu `#2C6E9B`, vert `#236E4C`, violet `#7A5AA8`, brun `#9C4F10`, sarcelle `#1B6B7A`, framboise `#A03050`, gris `#6B6257`.

### Neutral
- **Crème** (creme) : fond de page. **Blanc** : cartes.
- **Encre** (encre) : texte. **Gris** et **Gris clair** : métadonnées.
- **Bord** et **Bord fort** : bordures des cartes et des boutons fantômes.

### Named Rules
**La règle de la paire.** Toute couleur sémantique ou de catégorie s'emploie avec sa version pâle (texte foncé sur fond pâle), jamais en aplat saturé de grande taille.

## Typography

**Display Font:** Baloo 2 (700-800), servie par le Worker
**Body Font:** Nunito, servie par le Worker

### Hierarchy
- **Display** (700, clamp(2rem, 1.4rem + 2.4vw, 3.1rem), -0.5px) : `h1`.
- **Headline** (700, clamp(1.5rem, 1.2rem + 1.2vw, 2.1rem)) : `h2`.
- **Title** (700, 1.25rem) : `h3` ; `h4` à 1.05rem.
- **Marque** (Baloo 2 800, 1.5rem) : nom dans l'en-tête, avec sous-titre à 0.66rem.
- **Body** (Nunito 400, 16.5px) ; **petit** à 0.88rem.
- **Button** (Nunito 800, 0.95rem ; 0.84rem en petit).

## Layout

Contenu de 1120 px. Cartes en grilles fluides. Le calendrier de l'espace membres liste les événements par mois avec la pastille de catégorie.

## Elevation & Depth

- **ombre-sm** : `0 1px 2px rgba(29,27,25,.06), 0 2px 6px rgba(29,27,25,.05)`, cartes et boutons au repos.
- **ombre-md** : `0 2px 4px …, 0 8px 24px rgba(29,27,25,.08)`, survols.
- **ombre-lg** : `0 8px 40px rgba(29,27,25,.12)`, fenêtres et menus.

## Shapes

Échelle de rayons 6 / 10 / 14 / 20 / 28 px et pilule. Boutons et étiquettes en pilule, cartes en 20 px.

## Components

### Buttons
Nunito 800, `0.7rem 1.4rem`, bordure 2 px, pression `translateY(1px)`, transition 160 ms.
- **Principal** : noir, texte jaune. **Jaune** : jaune, texte noir. **Fantôme** : contour bord fort, survol jaune pâle. **Danger** : rouge pâle, plein rouge au survol. Variantes **petit** et **bloc**.

### Cartes
Blanc, bordure 1 px, rayon 20 px, padding 1.5rem, ombre-sm ; variantes **plate** et **serrée** ; cartes-liens qui montent au survol.

### Étiquettes
Pilules de catégorie (teinte sur fond pâle), étiquette noire à texte jaune pour la mise en avant.

### Widget HelloAsso
Iframe d'adhésion intégrée sur la page dédiée.

## Do's and Don'ts

### Do:
- **Do** garder le couple noir / jaune pour l'action principale.
- **Do** servir les polices depuis le Worker (CSP `font-src 'self'`).

### Don't:
- **Don't** utiliser Google Fonts ou un CDN : la page Confidentialité dit qu'aucune IP ne part vers un tiers.
- **Don't** employer une couleur de catégorie sans sa version pâle.
- **Don't** ajouter d'illustration dessinée : essayée et retirée le 10/09/2026, le rendu ne convenait pas.
