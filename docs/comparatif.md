---
layout: default
title: Tableau comparatif
nav_order: 3
---

# Tableau Comparatif

[← État de l'art](etat-de-lart/) · [Accueil](index.md)

---

## Modèle d'intégration

| Dimension                     | Android                                    | freedesktop                        | Cozy / Twake                             | OpenDesk                           |
| ----------------------------- | ------------------------------------------ | ---------------------------------- | ---------------------------------------- | ---------------------------------- |
| **Déclaration des capacités** | `<intent-filter>` dans AndroidManifest.xml | Fichier `.desktop` avec `MimeType` | `intents` dans le manifest JSON de l'app | Aucune — intégrations hardcodées   |
| **Résolution**                | Système parcourt tous les intent-filters   | `xdg-open` / `xdg-mime`            | Stack parcourt les manifests installés   | N/A (routes ICS statiques)         |
| **Canal de communication**    | IPC natif (Binder)                         | D-Bus                              | `window.postMessage` via iframe          | HTTP proxy (ICS)                   |
| **Multi-provider**            | Oui (chooser dialog)                       | Oui (app par défaut configurable)  | Oui (liste de services + chooser)        | Non (Nextcloud uniquement)         |
| **Auth**                      | Permissions Android                        | Portails Flatpak                   | pas besoin                               | OIDC tokens via ICS                |
| **Transfert de données**      | Intent extras + Content Providers          | D-Bus / fichiers partagés          | postMessage (base64 ou ref document)     | Backend HTTP (fichiers volumineux) |

## Le File Picker spécifiquement

| Aspect                    | Cozy / Twake                                  | openDesk                           | Open Buro (proposé)                                         |
| ------------------------- | --------------------------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| **Déclenchement**         | `cozy.intents.start('PICK', 'io.cozy.files')` | Code frontend OX appelle ICS `/fs` | App cliente appelle plateforme `/resolve` puis ouvre iframe |
| **Découverte du service** | Dynamique (manifests)                         | Hardcodé (ICS → Nextcloud)         | Dynamique (registre de capabilities)                        |
| **UI du picker**          | App Drive dans iframe                         | Composant Nextcloud dans OX        | Chaque drive fournit son propre front                       |
| **Auth**                  | Stack gère les tokens                         | ICS silent OIDC login              | Sessions pré-existantes (hackathon)                         |
| **Retour**                | postMessage « completed » + doc JSON          | Réponse HTTP via ICS               | postMessage avec sémantique à définir                       |
| **Fichiers volumineux**   | Base64 dans postMessage (limité)              | Backend-to-backend (scalable)      | URL avec token intégré (proposé)                            |
| **Extensibilité**         | Toute app déclarant PICK sur io.cozy.files    | Nécessite nouveau endpoint ICS     | Toute source inscrivant la capability                       |

## Mapping des concepts

| Concept Android            | Cozy Cloud                         | openDesk                  | Open Buro (proposé)                  |
| -------------------------- | ---------------------------------- | ------------------------- | ------------------------------------ |
| `<intent-filter>`          | `intents` dans manifest            | *(pas d'équivalent)*      | Capability dans le registre          |
| `action` (PICK)            | `action` (PICK)                    | Endpoint ICS (`/fs`)      | `action` (PICK)                      |
| `data` / MIME type         | `type` (MIME ou doctype)           | Implicite dans l'endpoint | `type` (files, images…)              |
| `startActivityForResult()` | `cozy.intents.start().then()`      | JS appelle ICS + callback | `lib.resolve().open().then()`        |
| Chooser dialog             | PICK secondaire sur `io.cozy.apps` | *(N/A)*                   | Multi-capabilities dans le résolveur |
| `onActivityResult()`       | `service.terminate(doc)`           | Réponse ICS               | postMessage callback                 |

---

[Suivant : Proposition pour le Hackathon →](proposition-hackathon/)
