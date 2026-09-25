# CLAUDE.md — Règles de travail

## PRIORITÉ : EFFICACITÉ TOKEN

* Sois concis.
* Ne répète pas ma demande.
* Pas d'explication longue sauf si je la demande.
* Après une modification, réponds avec un résumé très court : fichiers modifiés + résultat.
* Évite toute sortie verbeuse, narration ou commentaire inutile.

## EXPLORATION DU PROJET

* NE SCANNE PAS tout le projet par défaut.
* NE fais pas de recherche globale (`find`, `rg`, `grep -R`, etc.) sauf si nécessaire.
* Commence toujours par les fichiers directement concernés par ma demande.
* Ne lis pas des fichiers non pertinents.
* Ne relis PAS un fichier déjà lu dans la session s'il n'a pas changé.
* Ne relis PAS plusieurs fois le même fichier sans raison.
* N'examine pas toute l'architecture avant une petite modification.
* Pour une modification ciblée, lis uniquement :

  1. le fichier concerné ;
  2. ses dépendances directes si nécessaire ;
  3. les fichiers de configuration nécessaires.
* N'analyse l'ensemble du projet que si je demande explicitement une analyse globale.

## MODIFICATIONS

* Fais uniquement les changements nécessaires à ma demande.
* Ne refactorise pas du code non demandé.
* Ne crée pas de nouveaux fichiers sauf nécessité réelle.
* Ne change pas les conventions existantes sans raison.
* Préserve le comportement existant.
* Avant de modifier, vérifie seulement le contexte nécessaire.

## COMMANDES

* Évite les commandes produisant énormément de sortie.
* Préfère des commandes ciblées.
* Ne lance pas automatiquement build, tests ou lint complets après chaque petite modification.
* Lance uniquement la vérification pertinente au changement effectué.
* Ne relance pas une commande déjà exécutée avec succès si rien n'a changé.

## GIT

* Utilise `git diff` pour vérifier tes propres modifications plutôt que de relire tous les fichiers.
* Ne fais pas d'analyse complète de l'historique Git sauf demande explicite.
* Ne modifie jamais de commit, branche ou historique sans ma demande.

## CONTEXTE

* Considère le contexte déjà fourni dans la conversation comme acquis.
* Ne demande pas de relire un fichier uniquement pour confirmer une information déjà connue.
* Utilise le contexte de la session avant d'utiliser des outils.
* Après `/compact`, récupère uniquement l'état nécessaire à la tâche en cours.

## AUTONOMIE

* Pour une demande claire et ciblée, exécute directement la modification.
* Ne passe pas plusieurs tours à expliquer ce que tu vas faire.
* Ne fais pas de plan détaillé pour une modification simple.
* Pour une tâche complexe, fais un plan court puis exécute.

## RÉPONSE FINALE

Format par défaut :

* Modifié : `fichier`
* Changements : 1 à 3 lignes maximum
* Vérification : résultat

Ne fournis pas le code complet des fichiers modifiés sauf si je le demande.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
