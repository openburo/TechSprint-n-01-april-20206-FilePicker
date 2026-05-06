---
layout: default
title: Accueil
nav_order: 1
lang_alt_url: /en/
---

# Open Buro — Tech Sprint n°1 : File Picker

*Préparé pour le hackathon Open Buro — Avril 2026*

---

## Résumé Exécutif

Open Buro vise à établir un **standard ouvert d'orchestration de services collaboratifs**. Le File Picker est le premier cas concret : permettre à n'importe quelle application (mail, docs, chat, agenda…) de demander à n'importe quel drive (TDrive, Fichier DINUM, Nextcloud…) de présenter une interface de sélection de fichiers, et de recevoir le résultat de manière standardisée.

Conceptuellement, trois couches doivent intervenir :

| Couche                  | Rôle                                                         | Exemple                                                             |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| **App cliente**         | Demande une action (ex. « attacher un fichier »)             | Tmail, Docs, Element                                                |
| **Source / Capability** | Expose un service (ex. « je sais présenter un file picker ») | TDrive, Fichier DINUM                                               |
| **Plateforme**          | Met en relation le client et la capability                   | Serveur d'intents minimal, ou configuration statique, ex Stack Cozy |


**Ce dossier présente :**

1. un état de l'art : patterns existants, comparaison d'implémentations
2. la présentation des 2 approches explorées pendant le techsprint :
   1. l'approche Front
   2. l'approche Back

---

## Sommaire

1. [État de l'art : Patterns d'Intents & Capabilities](etat-de-lart/)
   - [Android Intents](etat-de-lart/android-intents.md)
   - [Freedesktop.org (XDG)](etat-de-lart/freedesktop.md)
   - [Cozy Cloud / Twake Workplace](etat-de-lart/cozy-twake.md)
   - [openDesk (ZenDiS)](etat-de-lart/opendesk.md)
   - [Google Picker API](etat-de-lart/google-picker.md)
   - [Tableau comparatif](etat-de-lart/comparatif.md)
2. [Approche front](proposition-hackathon/)
   - [Sujets de réflexion pour les ateliers](proposition-hackathon/sujets-ateliers.md)
   - [Sémantique du File Picker Intent](proposition-hackathon/semantique-file-picker.md)
   - [Protocole postMessage détaillé](proposition-hackathon/protocole-postmessage.md)
   - [Contournements navigateur](proposition-hackathon/contournements-navigateur.md)
3. [Approche back](backend-approach/)
   - [Specification](backend-approach/specification.md)
   - [Demo](backend-approach/demo.md)
   - [Appendices](backend-approach/appendices.md)
4. [Bibliographie](bibliographie.md)
5. [Glossaire](glossaire.md)
