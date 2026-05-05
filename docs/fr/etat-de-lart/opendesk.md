---
layout: default
title: openDesk (ZenDiS)
parent: État de l'art
nav_order: 4
---

# openDesk (ZenDiS / Gouvernement Allemand)

[← Cozy Cloud / Twake](cozy-twake.md) · [État de l'art](index.md) · [Accueil](../index.md)

---

openDesk est une suite collaborative souveraine déployée sur Kubernetes, composée de : Nubus (IAM), OX App Suite (mail/calendrier), Nextcloud (fichiers), Element (chat Matrix), Jitsi (visio), OpenProject, XWiki, Collabora.

## L'Intercom Service (ICS)

openDesk n'a **pas de système d'intents** à proprement parler. À la place, l'**Intercom Service** (ICS), un middleware Node.js déployé avec Nubus, agit comme proxy backend-for-frontend pour résoudre les problèmes de CORS et d'authentification cross-app.

**Fonctionnement :**

1. Le frontend d'une app (ex. Open Xchange) envoie des requêtes à l'ICS
2. L'ICS modifie, authentifie et transmet la requête vers l'API de l'app cible (ex. Nextcloud)
3. L'ICS retourne la réponse à l'app appelante
4. pour l'affichage, chaque app appelante doit embarquer le composant graphique du file picker de l'app cible (ex NextCloud).
5. L'ICS maintient sa propre session OIDC via un **silent login** (iframe cachée contre Keycloak)

**Endpoints de l'ICS :**

| Endpoint           | Cible            | Usage                                |
| ------------------ | ---------------- | ------------------------------------ |
| `/fs`              | Nextcloud        | FilePicker — opérations fichiers     |
| `/navigation.json` | Portail Nubus    | Navigation centrale                  |
| `/nob`             | Nordeck (Matrix) | Visioconférence depuis le calendrier |
| `/wiki`            | XWiki            | Fil d'actualités du portail          |

## Le FilePicker openDesk

Le FilePicker Nextcloud est intégré dans OX App Suite pour : attacher des fichiers Nextcloud aux emails, insérer des liens Nextcloud dans les emails, sauvegarder des pièces jointes dans Nextcloud, attacher des fichiers aux entrées de calendrier. 
IL faut donc rajouter le code du composant de file picker de chaque app cible. Par ex ici l'[addon dans Open Xchange pour disposer d'un front Next Cloud](https://gitlab.open-xchange.com/extensions/nextcloud-integration/-/tree/main).

**Deux chemins d'intégration :**

- **Frontend** — Le JS d'OX App Suite appelle les endpoints ICS (`/fs`), qui proxie vers l'API Nextcloud avec les tokens OIDC appropriés
- **Backend** — Le middleware OX communique directement avec l'API Nextcloud pour les transferts de fichiers volumineux (évite de faire transiter les données par le navigateur)

**Conséquences**
- l'app appelante dispose de tous les droits de l'utilisateur sur l'applicatoin cible (pas de zero trust)
- l'ICS a tout les droits sur toutes les données de tous les utilisateurs de l'application cible (pas de zero trust)
- il faut modifier les clients des app appelantes pour y mettre les composants graphiques du File picker de l'app cible, ce qui génère des poinst d'attention sur la gestion des routes, de mise à jour des composants, de coordination des version entre le FP dans l'app appelante et l'app cible.

## Ressources openDesk

| Ressource                             | URL                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| Architecture openDesk                 | https://docs.opendesk.eu/operations/architecture/#filepicker                 |
| UI de l'intégration Nextcloud dans OX | https://gitlab.open-xchange.com/extensions/nextcloud-integration/-/tree/main |
| Documentation Intercom Service        | https://docs.software-univention.de/intercom-service/latest/index.html       |
| Code source Intercom Service          | https://github.com/univention/intercom-service                               |

---

[Suivant : Google Picker API →](google-picker.md)
