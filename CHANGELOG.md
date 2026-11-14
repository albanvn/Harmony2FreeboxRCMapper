# Changelog

Toutes les évolutions notables de Harmony2FreeboxRCMapper sont consignées ici.
Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet respecte le [versionnage sémantique](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

- Changelog consultable dans l'application : cliquer sur la version (en-tête ou pied de page) l'ouvre dans une fenêtre.
- Badge de version dans l'en-tête des pages Main, Edit et Help.
- Favicon SVG (télécommande et signal).
- Script de déploiement sur le serveur Jeedom par SSH (`npm run deploy:jeedom`) : mise à jour git, redémarrage du service et contrôle HTTP.
- Tests unitaires (`npm test`).

### Modifié

- Correspondance des boutons insensible à la casse et aux espaces.
- Logs plus détaillés : fichier de règles utilisé, nombre de règles chargées, bouton sans règle.

### Corrigé

- `rules.json` est toujours lu à la racine du projet, quel que soit le dossier de lancement du serveur.
- Plus de version « v1.0.0 » affichée en dur quand l'API ne répond pas.

## [1.1.0] - 2025-12-12

### Ajouté

- Réglage de l'adresse de la Freebox (`freeboxHost`) dans la page Edit.
- Endpoint `/api/ping` (renvoie aussi l'uptime du serveur).

### Modifié

- Documentation revue.

## [1.0.1] - 2025-11-22

### Ajouté

- Pied de page avec la version de l'application (`/api/version`).
- Section « Limitations » et captures d'écran dans la documentation.

### Modifié

- Port par défaut : 8042.
- Moins de logs.
- Documentation sur la récupération du code de la télécommande.

## [1.0.0] - 2025-11-17

### Ajouté

- Première version : émulation d'un appareil Roku pour la télécommande Harmony et traduction des boutons en commandes Freebox.
