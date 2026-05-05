---
layout: default
title: Freedesktop.org (XDG)
parent: État de l'art
nav_order: 2
---

# Freedesktop.org (Standards Linux / XDG)

[← Android Intents](android-intents.md) · [État de l'art](index.md) · [Accueil](../index.md)

---

Dans l'écosystème Linux, l'équivalent des intent-filters se trouve dans les **fichiers .desktop** :

```ini
[Desktop Entry]
Name=Mon App
MimeType=image/png;image/jpeg;text/plain;
Categories=Graphics;Viewer;
Exec=monapp %U
```

**Mécanismes associés :**

- **`xdg-open` / `xdg-mime`** — routage des « intents » vers l'app par défaut pour un type MIME
- **XDG Intents (émergent)** — proposition récente d'intents explicites via D-Bus (`org.freedesktop.portal.FileChooser`), plus proche du modèle Android/iOS
- **Portails Flatpak/PipeWire** — sandboxing inter-app avec médiation par le système

L'interface `org.freedesktop.portal.FileChooser` de D-Bus est particulièrement pertinente : elle définit un protocole standard pour qu'une app sandboxée demande à l'environnement de bureau d'ouvrir un sélecteur de fichiers, sans avoir accès direct au système de fichiers.

**Points saillants pour Open Buro :**
- Modèle plus décentralisé qu'Android (pas de manifeste central unique)
- Basé sur des fichiers standards partagés par GNOME/KDE/etc.
- Le portail FileChooser est une source d'inspiration directe pour la sémantique
- Freedesktop propose une définition d'[API intéressante pour le file picker](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.FileChooser.html) mais aussi pour d'autres interapp, comme par exemple [le presse papier](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.Clipboard.html), [drag-and-drop ou copy-paste](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.FileTransfer.html).

---

[Suivant : Cozy Cloud / Twake →](cozy-twake.md)
