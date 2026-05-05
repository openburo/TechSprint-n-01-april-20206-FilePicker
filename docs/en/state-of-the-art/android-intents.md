---
layout: default
title: Android Intents
parent: State of the Art
nav_order: 1
lang_alt_url: /fr/etat-de-lart/android-intents/
---

# Android Intents

[← State of the Art](index.md) · [Home](../index.md)

---

Implements a pattern based on **intents and capabilities**. Each application declares **intent filters** in its `AndroidManifest.xml` to describe its capabilities:

```xml
<activity android:name=".FilePickerActivity">
  <intent-filter>
    <action android:name="android.intent.action.PICK" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="*/*" />
  </intent-filter>
</activity>
```

**Key concepts:**

- **Action** — verb describing the operation (`PICK`, `VIEW`, `SEND`, `EDIT`, `CREATE`)
- **Data / Type** — MIME type or URI the action operates on
- **Category** — additional context (`DEFAULT`, `BROWSABLE`, `LAUNCHER`)
- **Resolution** — the system walks through all declared intent filters and finds compatible apps
- **Chooser** — if several apps match, the user picks one
- **Result** — `startActivityForResult()` → the calling app gets the result back via `onActivityResult()`

**Takeaways for Open Buro:**
- The system is **decentralized**: each app declares its own capabilities
- Resolution is **dynamic**: it adapts to the apps that are installed
- An intent can carry data in both directions (request and response)
- The permission model is orthogonal to intents

---

[Next: Freedesktop.org →](freedesktop.md)
