---
layout: default
title: Android Intents
parent: État de l'art
nav_order: 1
---

# Android Intents

[← État de l'art](index.md) · [Accueil](../index.md)

---

Implémente un pattern basé sur des **intents et capabilities**. Chaque application déclare dans son `AndroidManifest.xml` des **intent-filters** qui décrivent ses capacités :

```xml
<activity android:name=".FilePickerActivity">
  <intent-filter>
    <action android:name="android.intent.action.PICK" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="*/*" />
  </intent-filter>
</activity>
```

**Concepts clés :**

- **Action** — verbe décrivant l'opération (`PICK`, `VIEW`, `SEND`, `EDIT`, `CREATE`)
- **Data / Type** — type MIME ou URI sur lequel l'action opère
- **Category** — contexte additionnel (`DEFAULT`, `BROWSABLE`, `LAUNCHER`)
- **Résolution** — le système parcourt tous les intent-filters déclarés et trouve les apps compatibles
- **Chooser** — si plusieurs apps matchent, l'utilisateur choisit
- **Résultat** — `startActivityForResult()` → l'app appelante récupère le résultat via `onActivityResult()`

**Points saillants pour Open Buro :**
- Le système est **décentralisé** : chaque app déclare ses propres capacités
- La résolution est **dynamique** : elle s'adapte aux apps installées
- L'intent peut porter des données dans les deux sens (requête et réponse)
- Le modèle de permissions est orthogonal aux intents

---

[Suivant : Freedesktop.org →](freedesktop.md)
