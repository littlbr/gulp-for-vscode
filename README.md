# Gulp for VS Code

Extension VS Code minimaliste : liste les tâches Gulp du projet, les lance, les arrête et les relance, avec un statut clair.

## Fonctions

- Vue **Gulp** dans la barre d'activités : une ligne par tâche détectée (`gulp --tasks-simple`).
- ▶ lancer, puis ■ arrêter et ⟳ relancer quand la tâche tourne.
- Statut par tâche : arrêtée, en cours (avec la durée), en erreur (code de sortie) ou en cours avec une erreur de compilation (watch toujours actif). L'erreur disparaît au prochain build réussi.
- Indicateur coloré dans la barre d'état (vert : en cours, rouge : erreur).
- Clic sur une tâche : affiche son terminal (console et erreurs). Double clic sur une tâche arrêtée : la lance. Un bouton terminal apparaît aussi sur les tâches en cours ou en erreur.
- Détection relancée automatiquement quand le `gulpfile` change.

## Réglage

`gulpRunner.statusBarClickAction` : action au clic sur l'indicateur de la barre d'état.
- `view` (défaut) : affiche la vue Gulp.
- `terminal` : affiche ou masque le terminal de la tâche en cours.

Un second clic sur une tâche de la vue (ou sur la barre d'état en mode `terminal`) referme le terminal ouvert.

Le réglage se change aussi depuis la roue dentée en haut de la vue Gulp.

## Installation

```bash
code --install-extension releases/gulp-for-vscode-0.2.4.vsix
```

Puis recharger la fenêtre VS Code.

## Prérequis

- Gulp installé dans le projet (`node_modules/.bin/gulp`) ou disponible via `npx`.
- Un `gulpfile.js|mjs|cjs|ts` à la racine du dossier ouvert.

## Construire le paquet

```bash
npm run package   # produit releases/gulp-for-vscode-<version>.vsix (aucune dépendance, fichier versionné dans le dépôt)
```

## Limites

Un seul gulpfile par dossier de l'espace de travail (à la racine). Les erreurs de compilation (Sass, esbuild) sont détectées en lisant la sortie de Gulp (`Error:`, `[ERROR]`) et signalées dans la vue et la barre d'état, mais pas dans l'onglet Problèmes.
