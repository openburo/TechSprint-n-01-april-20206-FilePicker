---
layout: default
title: Sémantique File Picker
parent: Proposition Hackathon
nav_order: 1
---

# Sémantique du File Picker Intent (DRAFT ALPHA)

[← Proposition Hackathon](index.md) · [Accueil](../index.md)

---

## Paramètres de l'intent (client → service, via query string ou postMessage init)

| Paramètre  | Type     | Description                                                      |
| ---------- | -------- | ---------------------------------------------------------------- |
| `action`   | string   | `PICK` (sélectionner) ou `SAVE` (déposer)                        |
| `type`     | string   | `files` — extensible à `images`, `documents`, etc.               |
| `multiple` | boolean  | Autoriser la sélection de plusieurs fichiers                     |
| `accept`   | string[] | Filtres MIME optionnels (ex. `["image/*", "application/pdf"]`)   |
| `data`     | object   | Données additionnelles (ex. pour SAVE : `{ content, filename }`) |

## Réponse de l'intent (service → client, via postMessage)

**Message « ready » :**
```json
{ "type": "intent:ready" }
```

**Message « completed » (PICK — retour par lien) :**
```json
{
  "type": "intent:done",
  "action": "PICK",
  "documents": [
    {
      "id": "abc-123",
      "name": "rapport.pdf",
      "mimeType": "application/pdf",
      "url": "https://drive.example.com/share/abc-123?token=xyz",
      "size": 245000
    }
  ]
}
```

**Message « completed » (PICK — retour par contenu) :**
```json
{
  "type": "intent:done",
  "action": "PICK",
  "documents": [
    {
      "name": "photo.png",
      "mimeType": "image/png",
      "content": "data:image/png;base64,iVBORw0KGgo..."
    }
  ]
}
```

**Message « error » :**
```json
{
  "type": "intent:error",
  "error": "user_cancelled"
}
```

**Message « cancel » :**
```json
{
  "type": "intent:cancel"
}
```

## Codes d'erreur proposés

| Code                | Signification                                 |
| ------------------- | --------------------------------------------- |
| `user_cancelled`    | L'utilisateur a fermé le picker               |
| `permission_denied` | Droits insuffisants                           |
| `not_found`         | Fichier introuvable                           |
| `size_exceeded`     | Fichier trop volumineux pour un retour base64 |
| `unknown`           | Erreur non catégorisée                        |

---

[Suivant : Protocole postMessage →](protocole-postmessage.md)
