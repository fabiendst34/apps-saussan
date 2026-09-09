# -*- coding: utf-8 -*-
"""
Genere le guide PDF remis aux membres du bureau et du comite d'administration.

    python docs/guide-membres.py

Seule dependance : reportlab (`pip install reportlab`). Elle sert uniquement a
fabriquer ce document — le site, lui, n'a toujours aucune dependance.
Le fichier produit est docs/Guide-membres-APPS.pdf.
"""

import os

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, KeepTogether, ListFlowable, ListItem,
    NextPageTemplate, PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle,
)

# --- Charte, reprise du logo -----------------------------------------------
JAUNE = colors.HexColor('#F2A93B')
JAUNE_PALE = colors.HexColor('#FDF2DE')
NOIR = colors.HexColor('#1D1B19')
GRIS = colors.HexColor('#6B6257')
CREME = colors.HexColor('#FBF7F0')
BORD = colors.HexColor('#EBE2D4')
VERT = colors.HexColor('#236E4C')
VERT_PALE = colors.HexColor('#E4F4EB')
ROUGE = colors.HexColor('#A03050')
ROUGE_PALE = colors.HexColor('#FBE9EE')

MARGE = 20 * mm
LARGEUR_UTILE = A4[0] - 2 * MARGE

RACINE = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(RACINE, 'Guide-membres-APPS.pdf')

# --- Styles -----------------------------------------------------------------
base = getSampleStyleSheet()

S = {
    'titre': ParagraphStyle(
        'titre', parent=base['Title'], fontName='Helvetica-Bold',
        fontSize=30, leading=34, textColor=NOIR, alignment=TA_CENTER, spaceAfter=0),
    'sous_titre': ParagraphStyle(
        'sous_titre', parent=base['Normal'], fontName='Helvetica',
        fontSize=13, leading=19, textColor=GRIS, alignment=TA_CENTER),
    'h1': ParagraphStyle(
        'h1', parent=base['Heading1'], fontName='Helvetica-Bold',
        fontSize=17, leading=21, textColor=NOIR, spaceBefore=2, spaceAfter=7),
    'h2': ParagraphStyle(
        'h2', parent=base['Heading2'], fontName='Helvetica-Bold',
        fontSize=12, leading=16, textColor=NOIR, spaceBefore=13, spaceAfter=4),
    'p': ParagraphStyle(
        'p', parent=base['Normal'], fontName='Helvetica',
        fontSize=9.8, leading=14.4, textColor=NOIR, spaceAfter=6),
    'muet': ParagraphStyle(
        'muet', parent=base['Normal'], fontName='Helvetica',
        fontSize=8.8, leading=13, textColor=GRIS, spaceAfter=6),
    'liste': ParagraphStyle(
        'liste', parent=base['Normal'], fontName='Helvetica',
        fontSize=9.8, leading=14, textColor=NOIR, spaceAfter=3),
    'cellule': ParagraphStyle(
        'cellule', parent=base['Normal'], fontName='Helvetica',
        fontSize=8.8, leading=12.4, textColor=NOIR),
    'cellule_titre': ParagraphStyle(
        'cellule_titre', parent=base['Normal'], fontName='Helvetica-Bold',
        fontSize=8.8, leading=12.4, textColor=NOIR),
    'encart': ParagraphStyle(
        'encart', parent=base['Normal'], fontName='Helvetica',
        fontSize=9.3, leading=13.6, textColor=NOIR),
    'encart_titre': ParagraphStyle(
        'encart_titre', parent=base['Normal'], fontName='Helvetica-Bold',
        fontSize=9.6, leading=13.6, textColor=NOIR, spaceAfter=3),
}


def p(texte, style='p'):
    return Paragraph(texte, S[style])


def puces(items, style='liste'):
    return ListFlowable(
        [ListItem(Paragraph(t, S[style]), leftIndent=12) for t in items],
        bulletType='bullet', bulletFontSize=6, bulletOffsetY=1.5,
        bulletColor=JAUNE, leftIndent=13, spaceAfter=7,
    )


def etapes(items):
    """Liste numerotee, pour les gestes a faire dans l'ordre."""
    return ListFlowable(
        [ListItem(Paragraph(t, S['liste']), leftIndent=15) for t in items],
        bulletType='1', bulletFormat='%s.', bulletFontName='Helvetica-Bold',
        bulletFontSize=9.8, bulletColor=JAUNE, leftIndent=16, spaceAfter=7,
    )


def encart(titre, corps, fond=JAUNE_PALE, trait=JAUNE):
    """Bloc mis en avant : un avertissement ou une regle a retenir."""
    interieur = [p(titre, 'encart_titre')] + [p(c, 'encart') for c in corps]
    t = Table([[interieur]], colWidths=[LARGEUR_UTILE])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), fond),
        ('LINEBEFORE', (0, 0), (0, -1), 2.4, trait),
        ('LEFTPADDING', (0, 0), (-1, -1), 11),
        ('RIGHTPADDING', (0, 0), (-1, -1), 11),
        ('TOPPADDING', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
    ]))
    return KeepTogether([t, Spacer(1, 9)])


def tableau(entetes, lignes, largeurs):
    donnees = [[p(c, 'cellule_titre') for c in entetes]]
    donnees += [[p(c, 'cellule') for c in ligne] for ligne in lignes]
    t = Table(donnees, colWidths=largeurs, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), CREME),
        ('LINEBELOW', (0, 0), (-1, 0), 1.1, JAUNE),
        ('LINEBELOW', (0, 1), (-1, -2), 0.5, BORD),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return KeepTogether([t, Spacer(1, 10)])


def champ(nom, role):
    """Ligne d'un inventaire de champs de formulaire."""
    return [f'<b>{nom}</b>', role]


# --- Habillage des pages ----------------------------------------------------
def logo(c, x, y, taille):
    """Le cartable du logo, redessine en primitives PDF."""
    u = taille / 120.0
    c.saveState()
    c.setFillColor(JAUNE)
    c.roundRect(x + 27 * u, y + 96 * u, 15 * u, 20 * u, 5 * u, stroke=0, fill=1)
    c.roundRect(x + 78 * u, y + 96 * u, 15 * u, 20 * u, 5 * u, stroke=0, fill=1)
    c.roundRect(x + 8 * u, y + 16 * u, 104 * u, 88 * u, 18 * u, stroke=0, fill=1)
    c.setStrokeColor(NOIR)
    c.setLineWidth(7 * u)
    c.setLineCap(1)
    for dx in (0, 36 * u):
        chemin = c.beginPath()
        chemin.moveTo(x + 32 * u + dx, y + 62 * u)
        chemin.curveTo(x + 42 * u + dx, y + 76 * u, x + 42 * u + dx, y + 76 * u,
                       x + 52 * u + dx, y + 62 * u)
        c.drawPath(chemin, stroke=1, fill=0)
    c.setFillColor(colors.white)
    c.roundRect(x + 22 * u, y + 10 * u, 20 * u, 24 * u, 5 * u, stroke=0, fill=1)
    c.roundRect(x + 78 * u, y + 10 * u, 20 * u, 24 * u, 5 * u, stroke=0, fill=1)
    c.restoreState()


def couverture(c, doc):
    c.saveState()
    c.setFillColor(CREME)
    c.rect(0, 0, A4[0], A4[1], stroke=0, fill=1)
    c.setFillColor(JAUNE)
    c.rect(0, A4[1] - 8 * mm, A4[0], 8 * mm, stroke=0, fill=1)
    logo(c, A4[0] / 2 - 21 * mm, A4[1] - 92 * mm, 42 * mm)
    c.setFillColor(GRIS)
    c.setFont('Helvetica', 9)
    c.drawCentredString(A4[0] / 2, 16 * mm,
                        'APPS — Association des Parents des Pitchouns Saussannais · apps-saussan.fr')
    c.restoreState()


def interieur(c, doc):
    c.saveState()
    c.setFillColor(JAUNE)
    c.rect(0, A4[1] - 4 * mm, A4[0], 4 * mm, stroke=0, fill=1)
    c.setStrokeColor(BORD)
    c.setLineWidth(0.5)
    c.line(MARGE, 14 * mm, A4[0] - MARGE, 14 * mm)
    c.setFillColor(GRIS)
    c.setFont('Helvetica', 8)
    c.drawString(MARGE, 9.5 * mm, 'Guide du membre — événements et articles')
    c.drawRightString(A4[0] - MARGE, 9.5 * mm, str(doc.page))
    c.restoreState()


def construire():
    doc = BaseDocTemplate(
        SORTIE, pagesize=A4,
        leftMargin=MARGE, rightMargin=MARGE, topMargin=MARGE, bottomMargin=22 * mm,
        title='Guide du membre — événements et articles',
        author='APPS Saussan',
        subject="Prise en main de l'espace membres du site apps-saussan.fr",
    )
    cadre = Frame(MARGE, 22 * mm, LARGEUR_UTILE, A4[1] - MARGE - 22 * mm, id='corps')
    doc.addPageTemplates([
        PageTemplate(id='couverture', frames=[cadre], onPage=couverture),
        PageTemplate(id='interieur', frames=[cadre], onPage=interieur),
    ])
    doc.build(contenu())
    return SORTIE


# ---------------------------------------------------------------------------
#  Le texte du guide
# ---------------------------------------------------------------------------
def contenu():
    h = []

    # ---------------------------------------------------------- couverture
    h.append(Spacer(1, 96 * mm))
    h.append(p('Guide du membre', 'titre'))
    h.append(Spacer(1, 5 * mm))
    h.append(p('Publier un événement ou un article<br/>sur le site de l’association', 'sous_titre'))
    h.append(Spacer(1, 14 * mm))

    t = Table([[p(
        'Ce livret s’adresse aux membres du <b>bureau</b> et du <b>comité d’administration</b>. '
        'Il explique, sans aucun prérequis technique, comment ajouter une date au calendrier, '
        'écrire une actualité, et surtout comment décider de ce que voient les familles du village '
        'et de ce qui reste entre nous.', 'encart')]], colWidths=[110 * mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.white),
        ('BOX', (0, 0), (-1, -1), 0.8, BORD),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
        ('TOPPADDING', (0, 0), (-1, -1), 13),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 13),
    ]))
    h.append(t)
    # Sans cela, reportlab garderait le gabarit de couverture sur tout le livret.
    h.append(NextPageTemplate('interieur'))
    h.append(PageBreak())

    # ------------------------------------------------------------ page 2
    h.append(p('1. Entrer dans l’espace membres', 'h1'))
    h.append(p(
        'Le site a deux faces. La partie <b>publique</b>, que tout le monde voit, et l’<b>espace '
        'membres</b>, qui demande un identifiant. Vous êtes ici pour la seconde.'))
    h.append(etapes([
        'Rendez-vous sur <b>apps-saussan.fr</b>.',
        'Cliquez sur le bouton jaune <b>« Espace membres »</b>, en haut à droite.',
        'Saisissez votre adresse e-mail et votre mot de passe.',
    ]))
    h.append(p('Première connexion', 'h2'))
    h.append(p(
        'Vous n’avez pas de mot de passe au départ. Vous recevez un e-mail d’invitation contenant '
        'un lien : c’est lui qui vous permet de choisir votre mot de passe. Ce lien ne sert qu’une '
        'fois et expire au bout de sept jours. Passé ce délai, ou si vous ne trouvez pas le message '
        '(pensez à regarder dans les indésirables), demandez qu’on vous en renvoie un.'))
    h.append(p(
        'Le mot de passe doit faire au moins <b>dix caractères</b> et contenir au moins une lettre '
        'et un chiffre. En cas d’oubli, le lien <b>« Mot de passe oublié ? »</b> sous le formulaire '
        'de connexion vous en renvoie un nouveau.'))

    h.append(p('Ce que vous trouvez une fois connecté', 'h2'))
    h.append(tableau(
        ['Onglet', 'À quoi il sert'],
        [
            ['Calendrier', 'La vue du mois. C’est la page d’accueil de l’espace membres.'],
            ['Événements', 'La liste de toutes les dates, avec la corbeille.'],
            ['Articles', 'Les actualités, publiées ou en brouillon.'],
            ['Mon activité', 'Vos cent dernières actions sur le site.'],
            ['Mon compte', 'Votre nom, votre téléphone, votre mot de passe.'],
        ],
        [38 * mm, LARGEUR_UTILE - 38 * mm]))

    h.append(encart('Tout ce que vous faites est enregistré', [
        'Chaque création, modification et suppression est inscrite dans un historique, avec votre '
        'nom, la date et le détail de ce qui a changé. Ce n’est pas une surveillance : c’est ce qui '
        'permet de retrouver qui a modifié une date, et de <b>rattraper une erreur</b> sans avoir à '
        'chercher qui blâmer. Personne ne peut effacer cette trace, pas même l’administrateur.',
    ]))
    h.append(PageBreak())

    # ------------------------------------------------------------ page 3
    h.append(p('2. Les événements', 'h1'))
    h.append(p(
        'Un événement, c’est une date. Une réunion de bureau, un marché de Noël, une échéance à ne '
        'pas rater. Pour en créer un, cliquez sur <b>« Nouvel événement »</b> depuis le calendrier '
        'ou depuis la liste des événements.'))

    h.append(p('Les champs, un par un', 'h2'))
    h.append(tableau(
        ['Champ', 'Ce qu’il faut y mettre'],
        [
            champ('Titre', 'Obligatoire. Court et parlant : « Marché de Noël de l’école » plutôt que « MDN ».'),
            champ('Catégorie', 'Donne sa couleur et son icône à l’événement dans le calendrier. Voir « Date importante » plus bas.'),
            champ('Lieu', 'Facultatif. Là où ça se passe.'),
            champ('Destinataires', 'Qui, parmi les membres, verra cet événement. C’est expliqué en détail page suivante.'),
            champ('Quand', 'La date de début suffit. Cochez « Journée entière » s’il n’y a pas d’horaire précis, et remplissez la date de fin seulement si l’événement dure plusieurs jours.'),
            champ('Équipe de leaders', 'Cochez les membres qui portent l’organisation. Plusieurs noms possibles. Cela ne donne aucun droit particulier : c’est là pour qu’on sache à qui s’adresser.'),
            champ('Description', 'Déroulé, matériel à prévoir, qui contacter.'),
            champ('Publier sur le site public', 'La case qui décide de tout. Voir ci-dessous.'),
        ],
        [42 * mm, LARGEUR_UTILE - 42 * mm]))

    h.append(encart('La case qui rend un événement visible du village', [
        'Tant que <b>« Publier sur le site public »</b> n’est pas cochée, un événement reste dans '
        'l’espace membres et <b>personne à l’extérieur ne le voit</b>. Une fois cochée, il apparaît '
        'aussitôt sur la page Événements du site, figure parmi les trois prochains rendez-vous mis '
        'en avant sur la page d’accueil, et entre dans le calendrier auquel les familles peuvent '
        's’abonner depuis leur téléphone.',
        'Dans le calendrier de l’espace membres, un <b>petit cadenas</b> signale les événements qui '
        'ne sont pas publiés.',
    ]))

    h.append(p('« Date importante » : une date sans rendez-vous', 'h2'))
    h.append(p(
        'Choisissez cette catégorie pour une échéance à retenir plutôt que pour une rencontre : la '
        'date limite d’inscription à un séjour, le dépôt d’un dossier de subvention. Les champs '
        'd’horaire et de lieu disparaissent alors du formulaire, parce qu’ils n’ont pas de sens '
        'ici. L’événement s’affiche simplement comme une date au calendrier.'))
    h.append(PageBreak())

    # ------------------------------------------------------------ page 4
    h.append(p('3. Deux réglages à ne pas confondre', 'h1'))
    h.append(p(
        'C’est le point qui trompe le plus. <b>« Destinataires »</b> et <b>« Publier sur le site '
        'public »</b> ne répondent pas à la même question.'))
    h.append(puces([
        '<b>Destinataires</b> répond à : <i>quels membres de l’association voient cette date dans '
        'leur espace ?</i>',
        '<b>Publier sur le site public</b> répond à : <i>les familles du village la voient-elles ?</i>',
    ]))
    h.append(p(
        'Les trois cercles de l’association sont emboîtés : un membre du <b>bureau</b> siège aussi '
        'au <b>comité d’administration</b>, et tous deux sont des <b>membres</b>. L’inverse n’est '
        'pas vrai. Un événement réservé au bureau n’est donc pas seulement étiqueté « bureau » : il '
        '<b>disparaît complètement</b> du calendrier de ceux qui n’y siègent pas.'))

    h.append(tableau(
        ['Destinataires', 'Publier ?', 'Résultat'],
        [
            ['Tous les membres', 'Oui', 'Visible de tout le monde, y compris des familles. Le cas des fêtes, ventes et sorties.'],
            ['Tous les membres', 'Non', 'Visible de tous les membres connectés, invisible du public. Le cas d’une réunion de préparation.'],
            ['Comité d’administration', 'Non', 'Seuls le CA et le bureau la voient.'],
            ['Bureau', 'Non', 'Seul le bureau la voit.'],
            ['Bureau', 'Oui', 'À éviter : publier l’emporte, et l’événement redevient visible de tous.'],
        ],
        [36 * mm, 20 * mm, LARGEUR_UTILE - 56 * mm]))

    h.append(encart('Vous ne pouvez pas vous exclure vous-même', [
        'Le formulaire ne vous propose que les destinataires que vous pourrez vous-même relire. Si '
        'vous siégez au comité d’administration sans être au bureau, le choix « Bureau » ne vous est '
        'pas offert : cela vous éviterait de créer un événement que vous ne reverriez jamais.',
    ], fond=VERT_PALE, trait=VERT))

    h.append(p('Modifier, supprimer, récupérer', 'h2'))
    h.append(p(
        'Le bouton <b>Modifier</b> est sur la fiche de chaque événement. Toute modification est '
        'consignée dans l’historique, en bas de cette même fiche, avec le détail de ce qui a changé.'))
    h.append(p(
        'Le bouton <b>Supprimer</b> ne détruit rien définitivement : l’événement part dans la '
        '<b>corbeille</b>, accessible depuis l’onglet Événements. De là, un bouton <b>Restaurer</b> '
        'le remet en place. En cas de fausse manœuvre, rien n’est perdu.'))
    h.append(PageBreak())

    # ------------------------------------------------------------ page 5
    h.append(p('4. Les articles', 'h1'))
    h.append(p(
        'Un article, c’est une nouvelle qu’on raconte : le bilan d’une action, un changement à la '
        'cantine, un appel à bénévoles. On les écrit depuis l’onglet <b>Articles</b>, bouton '
        '<b>« Nouvel article »</b>.'))

    h.append(p('Brouillon d’abord, publication ensuite', 'h2'))
    h.append(p(
        'Un article naît toujours en <b>brouillon</b> : vous pouvez l’enregistrer, y revenir demain, '
        'le faire relire, sans que personne à l’extérieur n’en voie la moindre ligne. Il devient '
        'public le jour où vous cochez <b>« Publier sur le site »</b>. Vous pouvez décocher la case '
        'plus tard : l’article repasse en brouillon et disparaît du site.'))

    h.append(p('Les trois cases de la publication', 'h2'))
    h.append(tableau(
        ['Case', 'Effet'],
        [
            champ('Publier sur le site', 'Rend l’article visible de tous, à sa propre adresse, et l’ajoute au flux des actualités.'),
            champ('Mettre à la une', 'Le fait remonter dans la section « À la une » de la page d’accueil, qui affiche trois articles. Si aucun article n’est marqué, ce sont les trois plus récents qui s’affichent.'),
            champ('Prévenir les membres par e-mail', 'Envoie un message à tous les comptes actifs, avec le titre et le lien. À ne cocher qu’une fois l’article vraiment prêt : le message part immédiatement et ne se rattrape pas.'),
        ],
        [46 * mm, LARGEUR_UTILE - 46 * mm]))

    h.append(encart('La seule case qui ne se rattrape pas', [
        'Les deux premières cases se décochent : un article se dépublie, un article se retire de la '
        'une. La troisième, non. Une fois l’e-mail parti vers les boîtes de tous les membres, il n’y '
        'a plus de retour en arrière. Écrivez d’abord, relisez, publiez — et ne cochez '
        '«&nbsp;Prévenir les membres&nbsp;» qu’au tout dernier enregistrement.',
    ], fond=ROUGE_PALE, trait=ROUGE))

    h.append(p('Le résumé et l’image', 'h2'))
    h.append(p(
        'Le <b>résumé</b> est la ou les deux phrases affichées sous le titre sur la page d’accueil '
        'et dans la liste des actualités. C’est lui qui donne envie de cliquer : soignez-le.'))
    h.append(p(
        'L’<b>image mise en avant</b> illustre l’article partout où il apparaît. Vous pouvez envoyer '
        'une photo prise au téléphone telle quelle : votre navigateur la réduit tout seul avant '
        'l’envoi, inutile de la préparer. Remplissez la <b>description de l’image</b> juste en '
        'dessous : elle est lue à voix haute aux personnes malvoyantes et s’affiche si l’image ne '
        'charge pas. Une phrase simple suffit — « Les enfants devant les stands du marché de Noël ».'))

    h.append(p('Mettre le texte en forme', 'h2'))
    h.append(p(
        'Le texte s’écrit au clavier, sans barre d’outils. Quelques signes suffisent :'))
    h.append(tableau(
        ['Ce que vous tapez', 'Ce qui s’affiche'],
        [
            ['## Un sous-titre', 'Un sous-titre dans l’article'],
            ['- une ligne<br/>- une autre', 'Une liste à puces'],
            ['**important**', 'Le mot en gras'],
            ['*nuance*', 'Le mot en italique'],
            ['Une ligne vide', 'Sépare deux paragraphes'],
            ['https://…', 'Devient un lien cliquable, automatiquement'],
        ],
        [58 * mm, LARGEUR_UTILE - 58 * mm]))

    # ------------------------------------------------------------ page 6
    # Pas de saut force ici : le tableau de mise en forme se retrouvait seul
    # sur une page presque vide. L aide-memoire vient le completer.
    h.append(Spacer(1, 4 * mm))
    h.append(p('5. Aide-mémoire', 'h1'))
    h.append(p('« Je veux que ça apparaisse sur le site public. Que faire ? »', 'h2'))
    h.append(tableau(
        ['Ce que vous voulez montrer', 'La marche à suivre'],
        [
            ['Une date, dans l’agenda du site',
             'Événements → Nouvel événement → cocher <b>Publier sur le site public</b>.'],
            ['Les trois prochaines dates, sur la page d’accueil',
             'Rien de plus : les trois prochains événements publiés y remontent tout seuls.'],
            ['Une nouvelle, dans les actualités',
             'Articles → Nouvel article → cocher <b>Publier sur le site</b>.'],
            ['Une nouvelle, en grand sur la page d’accueil',
             'Le même article, en cochant en plus <b>Mettre à la une</b>.'],
            ['Une information réservée au bureau',
             'Événement avec Destinataires = <b>Bureau</b>, et surtout <b>sans</b> cocher « Publier ».'],
        ],
        [52 * mm, LARGEUR_UTILE - 52 * mm]))

    h.append(p('Les erreurs les plus fréquentes', 'h2'))
    h.append(puces([
        '<b>Oublier la case « Publier ».</b> Première cause de «&nbsp;pourquoi ça n’apparaît pas '
        'sur le site&nbsp;?&nbsp;». Le cadenas dans le calendrier vous le signale.',
        '<b>Cocher « Prévenir les membres » sur un brouillon.</b> Le message part aussitôt, et ne '
        'se rappelle pas.',
        '<b>Laisser la description de l’image vide.</b> Une minute d’écriture, et le site devient '
        'lisible par tout le monde.',
        '<b>Croire qu’une suppression est définitive.</b> Regardez dans la corbeille avant de tout '
        'ressaisir.',
    ]))

    h.append(encart('En cas de doute, essayez', [
        'Rien n’est irréversible : un article se dépublie, un événement se restaure, une '
        'modification se relit dans l’historique. Le pire qui puisse arriver est qu’une date reste '
        'quelques heures visible du village — ce qui n’a jamais fait de mal à personne.',
    ]))

    h.append(p('Une question, un compte à créer, un lien d’activation à renvoyer&nbsp;: écrivez à '
               '<b>apps.saussan@gmail.com</b>.', 'muet'))
    return h


if __name__ == '__main__':
    print(construire())
