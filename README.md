# Papillon Web (projet scolaire)

Version web de Papillon : le site vitrine papillon.bzh, plus une **app web connectée à Pronote** accessible sur `/fr/app`.

## Lancer le projet

Il faut [bun](https://bun.sh) (`npm install -g bun`).

```bash
bun install
bun dev
```

Puis ouvrir :

- http://localhost:3000/fr : le site vitrine
- http://localhost:3000/fr/app/login : l'app web (connexion Pronote)

> ⚠️ À utiliser **uniquement en local**. Le mot de passe Pronote passe par le serveur Next.js qui tourne sur ton ordinateur : ne mets pas ce serveur en ligne.

## Se connecter

- **Identifiants** : adresse Pronote de l'établissement (bouton « Trouver mon établissement » avec la géolocalisation), identifiant et mot de passe. Ne marche pas si le lycée passe par un ENT.
- **QR code** (marche aussi avec un ENT) : sur Pronote depuis un ordinateur, clique sur l'icône QR code, choisis un code à 4 chiffres, puis importe une capture du QR code (ou scanne-le avec la webcam) et tape le code.
- **Démo** : un élève fictif avec de fausses données, sans compte Pronote. Pratique pour l'oral si Pronote ne répond pas.

## Fonctionnalités

Accueil, emploi du temps (avec le contenu des cours), devoirs (cocher « fait »), notes et moyennes, vie scolaire (absences, retards, punitions, observations), actualités (accusé de lecture), messagerie (lire, répondre, nouveau message), menus de la cantine. Français et anglais.

## Organisation du code

- `src/app/api/pronote/route.ts` : la route serveur appelée par le navigateur. Elle contourne le blocage CORS en parlant à Pronote côté serveur.
- `src/lib/pronote/` : connexion et récupération des données avec la bibliothèque `@blockshub/pawnote-lts` (`pronote.ts`), mode démo (`demo.ts`), sessions en mémoire (`store.ts`), types (`types.ts`).
- `src/app/[lang]/app/` : les pages de l'app web.
- `src/components/web-app/` : l'interface (connexion, accueil, notes…).
- `src/i18n/dictionaries/web-app/` : tous les textes de l'app web (FR/EN).

## Crédits et licences

- Le site vitrine (pages, textes, images, logo) vient de [PapillonApp/papillon.bzh](https://github.com/PapillonApp/papillon.bzh) : © Association Papillon & contributeur·rice·s, tous droits réservés. Utilisé ici dans un cadre scolaire uniquement.
- La logique Pronote (`src/lib/pronote/`), le calcul des moyennes et les données de démo sont adaptés de l'app [PapillonApp/Papillon](https://github.com/PapillonApp/Papillon), sous licence **GPL-3.0** (voir `LICENSE-GPL-3.0`). Ces adaptations restent sous la même licence.
- Ce projet n'est ni affilié à l'association Papillon ni à Index Éducation (Pronote).
