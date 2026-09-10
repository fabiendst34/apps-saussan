# -*- coding: utf-8 -*-
"""
Illustration de l'article « APPS recherche des parents représentants ».

Meme langage graphique que les icones du site (src/lib/icones.js) : trait
unique, extremites arrondies, formes rondes, palette du logo. Dessinee a
trois fois la taille finale puis reduite, ce qui donne l'anticrenelage.
"""
import math, os
from PIL import Image, ImageDraw

CREME = (251, 247, 240)
JAUNE = (242, 169, 59)
JAUNE_PALE = (253, 242, 222)
NOIR = (29, 27, 25)
BLANC = (255, 255, 255)
BORD = (232, 222, 206)

L, H = 1600, 900          # taille finale
S = 3                     # facteur de surechantillonnage
SORTIE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                      'representants-parents.jpg')

img = Image.new('RGB', (L * S, H * S), CREME)
d = ImageDraw.Draw(img)

TRAIT = 7 * S


def disque(cx, cy, r, remplissage=None, contour=None, trait=0):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=remplissage,
              outline=contour, width=trait)


def buste(cx, cy, r, remplissage):
    """
    Les epaules : un demi-disque dont seul l'arc est trace. PIL dessinerait
    aussi la corde du bas, qui barrerait la silhouette de devant sur celles
    de derriere ; la ligne de sol suffit a fermer la forme.
    """
    boite = [cx - r, cy - r, cx + r, cy + r]
    d.pieslice(boite, 180, 360, fill=remplissage)
    d.arc(boite, 180, 360, fill=NOIR, width=TRAIT)


def capsule(points, largeur, couleur):
    """Trait epais aux extremites et aux angles arrondis."""
    d.line(points, fill=couleur, width=int(largeur), joint='curve')
    for x, y in points:
        disque(x, y, largeur // 2, remplissage=couleur)


def bras(points, largeur, remplissage):
    """Membre cerne d'un trait, comme le reste des silhouettes."""
    capsule(points, largeur, NOIR)
    capsule(points, largeur - 2 * TRAIT, remplissage)


# --- Fond : un grand rond pale, pour poser le groupe --------------------
disque(int(L * S * 0.5), int(H * S * 0.52), int(H * S * 0.47), remplissage=JAUNE_PALE)

# --- Sol ----------------------------------------------------------------
SOL = int(H * S * 0.80)
capsule([(int(L * S * 0.07), SOL), (int(L * S * 0.93), SOL)], 12 * S, BORD)

# --- Le groupe ----------------------------------------------------------
# Cinq silhouettes ; la troisieme leve la main et porte le jaune.
FIGURES = [
    # (centre x, rayon du buste, volontaire ?)
    (int(L * S * 0.155), int(H * S * 0.140), False),
    (int(L * S * 0.325), int(H * S * 0.166), False),
    (int(L * S * 0.500), int(H * S * 0.198), True),
    (int(L * S * 0.675), int(H * S * 0.166), False),
    (int(L * S * 0.845), int(H * S * 0.140), False),
]

# Les silhouettes des extremites passent derriere : le groupe gagne un peu
# de profondeur, et le volontaire se detache au premier plan.
for cx, r, volontaire in [FIGURES[0], FIGURES[4], FIGURES[1], FIGURES[3], FIGURES[2]]:
    corps = JAUNE if volontaire else BLANC
    r_tete = int(r * 0.44)
    cy_tete = SOL - r - int(r_tete * 1.34)

    if volontaire:
        # Le bras est trace avant le buste : sa racine disparait sous les
        # epaules, la jointure reste nette. Il monte presque a la verticale
        # pour ne pas venir barrer le visage du voisin.
        epaule = (cx + int(r * math.sin(math.radians(32))),
                  SOL - int(r * math.cos(math.radians(32))))
        coude = (cx + int(r * 0.66), SOL - int(r * 1.42))
        main = (cx + int(r * 0.74), SOL - int(r * 2.26))
        bras([epaule, coude, main], int(r * 0.24), JAUNE)
        disque(main[0], main[1], int(r * 0.17), remplissage=JAUNE,
               contour=NOIR, trait=TRAIT)

    buste(cx, SOL, r, corps)
    disque(cx, cy_tete, r_tete, remplissage=corps, contour=NOIR, trait=TRAIT)

# --- Reduction : c'est elle qui lisse les contours ----------------------
img = img.resize((L, H), Image.LANCZOS)
img.save(SORTIE, 'JPEG', quality=88, optimize=True, progressive=True)
print(SORTIE, os.path.getsize(SORTIE) // 1024, 'Ko')
