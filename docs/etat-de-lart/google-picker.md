---
layout: default
title: Google Picker API
parent: État de l'art
nav_order: 5
---

# Google Picker API (référence propriétaire)

[← openDesk](opendesk.md) · [État de l'art](index.md) · [Accueil](../index.md)

---

L'API Google Picker est l'implémentation propriétaire la plus mature d'un File Picker web. Bien qu'elle soit fermée et couplée à l'écosystème Google, sa conception — affinée sur plus de dix ans — est une source d'inspiration précieuse pour la sémantique, la structure de réponse, et les patterns UX d'Open Buro.

## Principe général

Le Google Picker se présente comme une boîte de dialogue « File Open » modale, rendue en overlay dans l'application appelante. Il permet aux utilisateurs de parcourir, rechercher et sélectionner des fichiers depuis Google Drive (et historiquement Photos, YouTube, Maps). L'app appelante reçoit en retour un objet structuré décrivant le(s) fichier(s) sélectionné(s).

Deux modes de distribution existent :
- **Web apps** — Le picker s'affiche en modale inline (iframe) dans la page de l'app appelante
- **Desktop apps** (beta) — Le picker s'ouvre dans un nouvel onglet du navigateur, avec retour par callback URL

Un web component (`@googleworkspace/drive-picker-element`) et un composant React (`@googleworkspace/drive-picker-react`) simplifient l'intégration.

## Architecture : le pattern Builder

Le Picker utilise un **Builder pattern** pour la configuration. L'app cliente ne manipule pas l'iframe directement — elle décrit ce qu'elle veut via `PickerBuilder`, qui génère un objet `Picker` encapsulant toute la logique d'affichage et de communication.

```javascript
const picker = new google.picker.PickerBuilder()
    .setOAuthToken('TOKEN_FOR_USER')       // Token OAuth2 de l'utilisateur
    .setAppId('1234567890')                 // Numéro de projet Cloud
    .setDeveloperKey('AIza...')             // Clé API
    .addView(google.picker.ViewId.DOCS)     // Vue initiale
    .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
    .setCallback(pickerCallback)            // Fonction de rappel
    .setLocale('fr')                        // Langue de l'interface
    .setMaxItems(10)                        // Nombre max de fichiers
    .setSelectableMimeTypes('image/png,application/pdf')
    .setTitle('Sélectionner un fichier')
    .setSize(800, 600)                      // Taille de la modale
    .build();

picker.setVisible(true);                    // Affiche le picker
```

**Leçon pour Open Buro :** Le Builder pattern est puissant mais suppose un SDK unique côté client. Pour un standard ouvert, il vaut mieux que ces paramètres puissent être passés dans l'URL ou via postMessage, afin de rester indépendant du framework. Mais disposer d'une librairie exposant une API pour faciliter les interactions avec le composant est un facilitateur d'implémentation.

## Concepts clés

### Views (Vues)

Le picker peut afficher différentes « vues » de contenu, que l'app cliente choisit :

| ViewId            | Description                                    |
| ----------------- | ---------------------------------------------- |
| `DOCS`            | Tous les fichiers Google Drive                 |
| `DOCS_IMAGES`     | Images uniquement                              |
| `DOCS_VIDEOS`     | Vidéos uniquement                              |
| `DOCUMENTS`       | Documents texte (Google Docs)                  |
| `SPREADSHEETS`    | Feuilles de calcul                             |
| `PRESENTATIONS`   | Présentations                                  |
| `PDFS`            | Fichiers PDF                                   |
| `FOLDERS`         | Navigation par dossiers (sélection de dossier) |
| `RECENTLY_PICKED` | Fichiers récemment sélectionnés                |

L'app peut empiler plusieurs vues, créant des onglets de navigation dans le picker. Elle peut aussi utiliser `DocsView` pour un contrôle plus fin : filtrer par propriétaire, naviguer depuis un dossier parent donné, activer la sélection de dossiers, etc.

**Pertinence pour Open Buro :** Le concept de vues est intéressant mais trop couplé à Google Drive. Pour un standard ouvert, les filtres MIME et les paramètres `accept` suffisent — c'est au service (Drive) de décider comment les présenter dans son UI.

### Features (Options)

Des flags activables/désactivables sur le picker :

| Feature                 | Effet                                        |
| ----------------------- | -------------------------------------------- |
| `MULTISELECT_ENABLED`   | Sélection multiple                           |
| `MINE_ONLY`             | N'afficher que les fichiers de l'utilisateur |
| `NAV_HIDDEN`            | Masquer la barre de navigation               |
| `SIMPLE_UPLOAD_ENABLED` | Activer l'upload de fichiers                 |
| `SUPPORT_DRIVES`        | Inclure les drives partagés                  |

**Pertinence pour Open Buro :** Les features `MULTISELECT_ENABLED` et `MINE_ONLY` correspondent directement aux paramètres `multiple` et potentiellement `scope` proposés dans notre spec. `SIMPLE_UPLOAD_ENABLED` correspond au mode `SAVE`.

## Authentification

Le Google Picker exige un **token OAuth 2.0** de l'utilisateur, passé via `setOAuthToken()`. C'est l'app cliente qui est responsable d'obtenir ce token (via le flux OAuth standard) puis de le transmettre au picker. Le picker ne fait pas d'authentification lui-même.

La portée requise est `drive.file` (accès limité aux fichiers sélectionnés ou créés par l'app, sans accès à l'intégralité du Drive).

**Leçon pour Open Buro :** Ce modèle est instructif mais lourd — il nécessite un SSO / OAuth entre l'app cliente et Google. Pour le hackathon, l'approche « sessions pré-existantes indépendantes » est bien plus pragmatique. En production, un mécanisme de token exchange médié par la plateforme (comme le fait l'ICS d'openDesk) serait préférable.

## Structure de la réponse (callback)

Lorsque l'utilisateur interagit avec le picker, la callback reçoit un objet `ResponseObject` structuré :

```javascript
function pickerCallback(data) {
  if (data.action === google.picker.Action.PICKED) {
    // Un ou plusieurs fichiers sélectionnés
    const documents = data.docs;
    documents.forEach(doc => {
      console.log('ID:', doc.id);
      console.log('Nom:', doc.name);
      console.log('MIME:', doc.mimeType);
      console.log('URL:', doc.url);
      console.log('Taille:', doc.sizeBytes);
      console.log('Dernier edit:', doc.lastEditedUtc);
      console.log('Embed URL:', doc.embedUrl);
      console.log('Download URL:', doc.downloadUrl);
      console.log('Thumbnails:', doc.thumbnails);
      console.log('Parent ID:', doc.parentId);
      console.log('Read only:', doc.readOnly);
      console.log('Partagé:', doc.isShared);
    });
  } else if (data.action === google.picker.Action.CANCEL) {
    console.log('Utilisateur a annulé');
  }
}
```

**Actions possibles dans la réponse :**

| Action   | Signification                                        |
| -------- | ---------------------------------------------------- |
| `PICKED` | L'utilisateur a sélectionné un ou plusieurs fichiers |
| `CANCEL` | L'utilisateur a annulé / fermé le picker             |
| `ERROR`  | Une erreur s'est produite                            |

**Propriétés du `DocumentObject` retourné :**

| Propriété       | Type    | Description                                        |
| --------------- | ------- | -------------------------------------------------- |
| `id`            | string  | Identifiant unique du fichier                      |
| `name`          | string  | Nom du fichier                                     |
| `mimeType`      | string  | Type MIME                                          |
| `url`           | string  | URL vers le fichier dans Drive                     |
| `downloadUrl`   | string  | URL de téléchargement directe                      |
| `embedUrl`      | string  | URL d'intégration (iframe)                         |
| `sizeBytes`     | number  | Taille en octets                                   |
| `lastEditedUtc` | number  | Timestamp de dernière modification                 |
| `iconUrl`       | string  | URL de l'icône du type de fichier                  |
| `description`   | string  | Description du fichier                             |
| `parentId`      | string  | ID du dossier parent                               |
| `isNew`         | boolean | Fichier venant d'être uploadé                      |
| `isShared`      | boolean | Fichier partagé                                    |
| `readOnly`      | boolean | Lecture seule                                      |
| `thumbnails`    | array   | Miniatures (url, width, height, type)              |
| `type`          | enum    | `DOCUMENT`, `PHOTO`, `VIDEO`                       |
| `audience`      | enum    | `LIMITED`, `DOMAIN_PUBLIC`, `PUBLIC`, `OWNER_ONLY` |
| `serviceId`     | enum    | Identifie le service source (`DOCS`)               |

**Leçon majeure pour Open Buro :** Cette structure de réponse est le produit de plus de dix ans d'itération. Pour notre spec, les champs essentiels à retenir sont :

| Google Picker          | Open Buro proposé                         | Priorité  |
| ---------------------- | ----------------------------------------- | --------- |
| `id`                   | `id`                                      | Essentiel |
| `name`                 | `name`                                    | Essentiel |
| `mimeType`             | `mimeType`                                | Essentiel |
| `url`                  | `url` (avec token intégré si besoin)      | Essentiel |
| `sizeBytes`            | `size`                                    | Utile     |
| `downloadUrl`          | Intégré dans `url`                        | Utile     |
| `embedUrl`             | Pas pour le hackathon                     | Futur     |
| `thumbnails`           | Pas pour le hackathon                     | Futur     |
| `lastEditedUtc`        | Pas pour le hackathon                     | Futur     |
| `isShared`, `audience` | Pas pertinent (stratégie propre au drive) | —         |

## Upload (mode SAVE)

Le Google Picker propose aussi une vue `DocsUploadView` pour **déposer** un fichier dans un dossier Drive. L'app cliente peut préconfigurer le dossier de destination via `setParent()`. Ce mode est l'équivalent de l'action `SAVE` dans la terminologie intents.

```javascript
const uploadView = new google.picker.DocsUploadView()
    .setParent('FOLDER_ID')      // Dossier de destination
    .setIncludeFolders(true);    // Autoriser la navigation dans les dossiers

const picker = new google.picker.PickerBuilder()
    .addView(uploadView)
    .setOAuthToken(oauthToken)
    .setCallback(uploadCallback)
    .build();
```

**Pertinence pour Open Buro :** Confirme que le File Picker doit supporter les deux modes (`PICK` et `SAVE`) et que le mode `SAVE` nécessite des données supplémentaires en entrée (contenu du fichier, nom, dossier de destination).

## Synthèse : ce que le Google Picker enseigne à Open Buro

| Aspect               | Approche Google                                         | Leçon pour Open Buro                                                                |
| -------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Intégration**      | SDK JS propriétaire + iframe contrôlée par Google       | Préférer des messages postMessage standardisés, SDK bridge en facilitateur optionel |
| **Configuration**    | Builder pattern avec méthodes chaînées                  | Paramètres dans l'URL ou le message `intent:init`                                   |
| **Auth**             | OAuth2 token passé par l'app cliente au picker          | Sessions indépendantes                                                              |
| **Réponse**          | Objet structuré riche (`DocumentObject`)                | Adopter le noyau : `id`, `name`, `mimeType`, `url`, `size`                          |
| **Actions**          | `PICKED`, `CANCEL`, `ERROR`                             | Correspond à `intent:done`, `intent:cancel`, `intent:error`                         |
| **Multi-select**     | Via `Feature.MULTISELECT_ENABLED`                       | Via paramètre `multiple: true` dans `intent:init`                                   |
| **Filtres MIME**     | Via `setSelectableMimeTypes()` ou `View.setMimeTypes()` | Via paramètre `accept: ["image/*"]` dans `intent:init`                              |
| **Upload/Save**      | Vue séparée `DocsUploadView`                            | Action `SAVE` avec `data: { content, filename }`                                    |
| **Taille du picker** | `setSize(width, height)`                                | `intent:resize` envoyé par le service, réalisé par l'app appelante ou SDK bridge    |
| **Localisation**     | `setLocale('fr')`                                       | Responsabilité du service (il connaît la langue de l'utilisateur)                   |
| **Web component**    | `<drive-picker>` custom element                         | Inspiration pour la lib front Open Buro                                             |

Le Google Picker démontre qu'un file picker web performant nécessite : 
* une structure de réponse riche mais normalisée, 
* un contrôle fin des types MIME acceptés, 
* le support du multi-select, 
* et une distinction claire entre les modes pick et upload. 

Ces enseignements nourrissent directement la [spec proposée](../proposition-hackathon/semantique-file-picker.md).

---

[← openDesk](opendesk.md) · [Suivant : Tableau comparatif →](../comparatif.md)
