---
layout: default
title: Freedesktop.org (XDG)
parent: State of the Art
nav_order: 2
lang_alt_url: /fr/etat-de-lart/freedesktop/
---

# Freedesktop.org (Linux / XDG Standards)

[← Android Intents](android-intents.md) · [State of the Art](index.md) · [Home](../index.md)

---

In the Linux ecosystem, the equivalent of intent filters is found in **.desktop files**:

```ini
[Desktop Entry]
Name=My App
MimeType=image/png;image/jpeg;text/plain;
Categories=Graphics;Viewer;
Exec=myapp %U
```

**Related mechanisms:**

- **`xdg-open` / `xdg-mime`** — routes "intents" to the default app for a given MIME type
- **XDG Intents (emerging)** — recent proposal for explicit intents over D-Bus (`org.freedesktop.portal.FileChooser`), closer to the Android/iOS model
- **Flatpak / PipeWire portals** — inter-app sandboxing with system-level mediation

The `org.freedesktop.portal.FileChooser` D-Bus interface is particularly relevant: it defines a standard protocol that lets a sandboxed app ask the desktop environment to open a file picker, without granting it direct access to the filesystem.

**Takeaways for Open Buro:**
- More decentralized than Android (no single central manifest)
- Based on standard files shared across GNOME / KDE / etc.
- The FileChooser portal is a direct source of inspiration for the semantics
- Freedesktop offers an [interesting file picker API definition](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.FileChooser.html) and also covers other inter-app interactions, such as [the clipboard](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.Clipboard.html) and [drag-and-drop / copy-paste](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.FileTransfer.html).

---

[Next: Cozy Cloud / Twake →](cozy-twake.md)
