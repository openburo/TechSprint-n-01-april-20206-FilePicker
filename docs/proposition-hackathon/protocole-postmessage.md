---
layout: default
title: Protocole postMessage
parent: Proposition Hackathon
nav_order: 2
---

# Protocole postMessage détaillé (DRAFT ALPHA)

[← Sémantique File Picker](semantique-file-picker.md) · [Proposition Hackathon](index.md) · [Accueil](../index.md)

---

```
Client                              Service (iframe)
  │                                      │
  │  ── iframe load ──────────────────▷  │
  │                                      │
  │  ◁── { type: "intent:ready" } ─────  │  (1) Service prêt
  │                                      │
  │  ── { type: "intent:init",    ─────▷ │  (2) Client envoie les paramètres
  │       action: "PICK",                │
  │       params: { multiple: true } }   │
  │                                      │
  │       ... user interacts ...         │
  │                                      │
  │  ◁── { type: "intent:resize",  ───── │  (optionnel) Redimensionner l'iframe
  │       height: 500 }                  │
  │                                      │
  │  ◁── { type: "intent:done",   ─────  │  (3) Résultat
  │       documents: [...] }             │
  │                                      │
  │  ── close iframe ─────────────────▷  │  (4) Client ferme
```

**Sécurité postMessage :** Chaque message doit être validé par `event.origin` côté récepteur.

---

[Suivant : Contournements navigateur →](contournements-navigateur.md)
