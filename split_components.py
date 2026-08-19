#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Standardisation des composants Angular : passage du mono-fichier .ts
(template et styles inline) a la structure officielle en trois fichiers
.ts / .html / .scss.

Usage, depuis la racine du projet :

    python split_components.py frontend/src/app             # simulation
    python split_components.py frontend/src/app --apply     # ecriture reelle

Le script est idempotent : un composant deja decoupe est ignore.
"""

import argparse
import os
import re
import sys
import textwrap


# ---------------------------------------------------------------------
# Extraction des blocs inline
# ---------------------------------------------------------------------

def find_matching_backtick(source, start):
    """Retourne l'index du backtick fermant, en ignorant les echappements."""
    i = start
    while i < len(source):
        c = source[i]
        if c == '\\':
            i += 2
            continue
        if c == '`':
            return i
        i += 1
    return -1


def extract_template(source):
    """Extrait le contenu de `template: \\`...\\`` -> (contenu, debut, fin)."""
    m = re.search(r'^\s*template:\s*`', source, re.MULTILINE)
    if not m:
        return None, -1, -1
    content_start = m.end()
    content_end = find_matching_backtick(source, content_start)
    if content_end == -1:
        return None, -1, -1

    block_end = content_end + 1
    # Absorbe la virgule et le saut de ligne qui suivent
    while block_end < len(source) and source[block_end] in ',\r\n':
        block_end += 1
        if source[block_end - 1] == '\n':
            break

    return source[content_start:content_end], m.start(), block_end


def extract_styles(source):
    """Extrait le contenu de `styles: [\\`...\\`]` -> (contenu, debut, fin)."""
    m = re.search(r'^\s*styles:\s*\[\s*`', source, re.MULTILINE)
    if not m:
        return None, -1, -1
    content_start = m.end()
    content_end = find_matching_backtick(source, content_start)
    if content_end == -1:
        return None, -1, -1

    block_end = content_end + 1
    # Absorbe ` ] , \n`
    while block_end < len(source) and source[block_end] in ' \t],\r\n':
        block_end += 1
        if source[block_end - 1] == '\n':
            break

    return source[content_start:content_end], m.start(), block_end


def clean_block(text):
    """Retire l'indentation commune et les lignes vides en bordure."""
    if text is None:
        return None
    text = text.replace('\r\n', '\n')
    lines = text.split('\n')
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    if not lines:
        return ''
    return textwrap.dedent('\n'.join(lines)).rstrip() + '\n'


# ---------------------------------------------------------------------
# Traitement d'un composant
# ---------------------------------------------------------------------

def process_component(ts_path, apply_changes):
    base = ts_path[:-3]                       # retire ".ts"
    name = os.path.basename(base)             # ex: home.component
    html_path = base + '.html'
    scss_path = base + '.scss'

    with open(ts_path, encoding='utf-8') as f:
        source = f.read()

    if 'templateUrl' in source:
        return 'deja_decoupe', name

    template, t_start, t_end = extract_template(source)
    styles, s_start, s_end = extract_styles(source)

    if template is None:
        return 'pas_de_template', name

    # Remplacement du bloc styles en premier (il est toujours apres template,
    # donc les index du template restent valides).
    new_source = source
    if styles is not None:
        new_source = (
            new_source[:s_start]
            + "  styleUrls: ['./%s.scss'],\n" % name
            + new_source[s_end:]
        )
    new_source = (
        new_source[:t_start]
        + "  templateUrl: './%s.html',\n" % name
        + new_source[t_end:]
    )

    if apply_changes:
        with open(html_path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(clean_block(template))
        if styles is not None:
            with open(scss_path, 'w', encoding='utf-8', newline='\n') as f:
                f.write(clean_block(styles))
        with open(ts_path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(new_source)

    detail = 'html + scss' if styles is not None else 'html seul'
    return 'ok', '%s (%s)' % (name, detail)


# ---------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Decoupe les composants Angular mono-fichier en .ts / .html / .scss"
    )
    parser.add_argument('racine', help="dossier a parcourir (ex: frontend/src/app)")
    parser.add_argument('--apply', action='store_true',
                        help="ecrit les fichiers (sans cette option : simulation)")
    args = parser.parse_args()

    if not os.path.isdir(args.racine):
        print("Dossier introuvable : %s" % args.racine)
        sys.exit(1)

    fichiers = []
    for dirpath, _dirnames, filenames in os.walk(args.racine):
        if 'node_modules' in dirpath:
            continue
        for fn in filenames:
            if fn.endswith('.component.ts') and not fn.endswith('.spec.ts'):
                fichiers.append(os.path.join(dirpath, fn))
    fichiers.sort()

    if not args.apply:
        print(">>> MODE SIMULATION : aucun fichier ne sera modifie.")
        print(">>> Relancer avec --apply pour ecrire.\n")

    compteurs = {'ok': 0, 'deja_decoupe': 0, 'pas_de_template': 0}
    for path in fichiers:
        statut, detail = process_component(path, args.apply)
        compteurs[statut] += 1
        symbole = {'ok': '[OK]  ', 'deja_decoupe': '[SKIP]',
                   'pas_de_template': '[!]   '}[statut]
        print('%s %s' % (symbole, detail))

    print('\n%d composant(s) traite(s), %d deja au format, %d sans template inline.'
          % (compteurs['ok'], compteurs['deja_decoupe'], compteurs['pas_de_template']))

    if not args.apply and compteurs['ok']:
        print('\nRelancer avec --apply pour appliquer.')


if __name__ == '__main__':
    main()
