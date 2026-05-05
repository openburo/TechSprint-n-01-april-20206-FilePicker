---
layout: default
title: File Picker Semantics
parent: Frontend Approach
nav_order: 1
lang_alt_url: /fr/proposition-hackathon/semantique-file-picker/
---

# File Picker Intent Semantics (DRAFT ALPHA)

[← Frontend Approach](index.md) · [Home](../index.md)

---

## Intent Parameters (client → service, via query string or postMessage init)

| Parameter  | Type     | Description                                                      |
| ---------- | -------- | ---------------------------------------------------------------- |
| `action`   | string   | `PICK` (select) or `SAVE` (deposit)                              |
| `type`     | string   | `files` — extensible to `images`, `documents`, etc.              |
| `multiple` | boolean  | Whether to allow multi-file selection                            |
| `accept`   | string[] | Optional MIME filters (e.g., `["image/*", "application/pdf"]`)   |
| `data`     | object   | Additional data (e.g., for SAVE: `{ content, filename }`)        |

## Intent Response (service → client, via postMessage)

**"ready" message:**
```json
{ "type": "intent:ready" }
```

**"completed" message (PICK — return by link):**
```json
{
  "type": "intent:done",
  "action": "PICK",
  "documents": [
    {
      "id": "abc-123",
      "name": "report.pdf",
      "mimeType": "application/pdf",
      "url": "https://drive.example.com/share/abc-123?token=xyz",
      "size": 245000
    }
  ]
}
```

**"completed" message (PICK — return by content):**
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

**"error" message:**
```json
{
  "type": "intent:error",
  "error": "user_cancelled"
}
```

**"cancel" message:**
```json
{
  "type": "intent:cancel"
}
```

## Proposed Error Codes

| Code                | Meaning                                            |
| ------------------- | -------------------------------------------------- |
| `user_cancelled`    | The user closed the picker                         |
| `permission_denied` | Insufficient permissions                           |
| `not_found`         | File not found                                     |
| `size_exceeded`     | File too large for a base64 return                 |
| `unknown`           | Uncategorized error                                |

---

[Next: postMessage Protocol →](postmessage-protocol.md)
