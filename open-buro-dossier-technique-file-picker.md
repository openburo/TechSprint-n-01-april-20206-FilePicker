# Open Buro — Dossier Technique : File Picker

## Inter-App Communication via Intents & Capabilities

*Préparé pour le hackathon Open Buro — Avril 2026*

---

## 1. Résumé Exécutif

Open Buro vise à établir un **standard ouvert d'orchestration de services collaboratifs**. Le File Picker est le premier cas concret : permettre à n'importe quelle application (mail, docs, chat, agenda…) de demander à n'importe quel drive (TDrive, Fichier DINUM, Nextcloud…) de présenter une interface de sélection de fichiers, et de recevoir le résultat de manière standardisée.

Conceptuellement, trois couches doivent intervir :

| Couche                  | Rôle                                                         | Exemple                                                             |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| **App cliente**         | Demande une action (ex. « attacher un fichier »)             | Tmail, Docs, Element                                                |
| **Source / Capability** | Expose un service (ex. « je sais présenter un file picker ») | TDrive, Fichier DINUM                                               |
| **Plateforme**          | Met en relation le client et la capability                   | Serveur d'intents minimal, ou configuration statique, ex Stack Cozy |

Ce dossier présente les patterns existants, une comparaison des implémentations, et des scénario possibles pour le hackathon.

---

## 2. État de l'art : Patterns d'Intents & Capabilities


### 2.1 Android Intents

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

### 2.2 Freedesktop.org (Standards Linux / XDG)

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

### 2.3 Cozy Cloud / Twake Workplace

Cozy implémente un système d'intents directement inspiré d'Android, adapté au contexte web.

#### Déclaration dans le manifest de l'app

```json
{
  "intents": [
    {
      "action": "PICK",
      "type": ["io.cozy.files", "image/*"],
      "href": "/pick"
    },
    {
      "action": "EDIT",
      "type": ["image/png"],
      "href": "/editor"
    }
  ]
}
```

Chaque intent déclaré contient :

- **`action`** — verbe : `CREATE`, `EDIT`, `OPEN`, `PICK`, `SHARE` (liste extensible)
- **`type`** — un ou plusieurs types de données (MIME ou doctype Cozy comme `io.cozy.files`)
- **`href`** — route relative dans l'app qui gère cet intent

#### Cycle de vie d'un intent

```
┌─────────────┐     POST /intents      ┌─────────────┐
│  App Client  │ ──────────────────────▷│    Stack     │
│   (Tmail)    │                        │  (Plateforme)│
└──────┬───────┘                        └──────┬───────┘
       │                                       │
       │  1. Client démarre l'intent           │ 2. Stack résout :
       │     action: PICK                      │    parcourt les manifests
       │     type: io.cozy.files               │    trouve les apps matchant
       │                                       │
       │  ◁─────── URL du service ─────────────┤
       │           + availableApps             │
       │                                       │
       │  3. Client ouvre iframe               │
       │     vers service URL                  │
       │                                       │
       ▼                                       │
┌──────────────┐                               │
│   iframe      │                               │
│  (Drive app)  │  4. Service query stack       │
│               │     pour détails de l'intent  │
│               │  5. Handshake postMessage     │
│               │  6. User picks file           │
│               │  7. service.terminate(doc)    │
└──────┬────────┘                               │
       │                                       │
       │  8. Client reçoit le résultat         │
       │     via postMessage                   │
       └───────────────────────────────────────┘
```

**Étapes détaillées :**

1. Le client appelle `cozy.intents.start('PICK', 'io.cozy.files')`
2. Le stack parcourt les manifests des apps installées, matche action + type
3. Le stack retourne l'URL du service (ou une liste si plusieurs matchent) + les apps non installées qui pourraient gérer l'intent (`availableApps`)
4. Le client ouvre une **iframe** pointant vers l'URL du service (avec `?intent={id}`)
5. Service et client établissent un canal via `window.postMessage` (handshake ready → ack → data)
6. L'utilisateur interagit avec le service (ex. navigue dans ses fichiers, sélectionne)
7. Le service appelle `service.terminate(document)` — envoie un message « completed » avec le résultat
8. Le client ferme l'iframe et exploite le résultat

#### Permissions

- Le client peut demander des permissions sur les documents retournés (`GET`, `ALL`)
- Le stack ne résout un intent vers un service que si ce service a déjà les permissions nécessaires sur le doctype
- Les permissions sont scoped aux documents spécifiques retournés

#### Ressources Cozy / Twake

| Ressource                                 | URL                                                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| PR du File Picker intent dans Twake Drive | https://github.com/linagora/twake-drive/pull/3787/changes                              |
| Template d'app cliente pour intents       | https://github.com/cozy/cozy-app-template/blob/master/src/components/Views/Intents.jsx |
| Lib de gestion des interactions iframe    | https://github.com/linagora/cozy-libs/tree/master/packages/cozy-interapp               |
| Composants de chargement d'iframe         | https://github.com/linagora/cozy-libs/tree/master/packages/cozy-ui-plus/src/Intent     |
| Documentation intents cozy-stack          | https://docs.cozy.io/en/cozy-stack/intents/                                            |

### 2.4 openDesk (ZenDiS / Gouvernement Allemand)

openDesk est une suite collaborative souveraine déployée sur Kubernetes, composée de : Nubus (IAM), OX App Suite (mail/calendrier), Nextcloud (fichiers), Element (chat Matrix), Jitsi (visio), OpenProject, XWiki, Collabora.

#### L'Intercom Service (ICS)

openDesk n'a **pas de système d'intents** à proprement parler. À la place, l'**Intercom Service** (ICS), un middleware Node.js déployé avec Nubus, agit comme proxy backend-for-frontend pour résoudre les problèmes de CORS et d'authentification cross-app.

**Fonctionnement :**

1. Le frontend d'une app (ex. Open Xchange) envoie des requêtes à l'ICS
2. L'ICS modifie, authentifie et transmet la requête vers l'API de l'app cible (ex. Nextcloud)
3. L'ICS retourne la réponse à l'app appelante
4. pour l'affichage, chaque app appelante doit embarquer le composant graphique du file picker de l'app cible (ex NextCloud).
5. L'ICS maintient sa propre session OIDC via un **silent login** (iframe cachée contre Keycloak)

**Endpoints de l'ICS :**

| Endpoint           | Cible            | Usage                                |
| ------------------ | ---------------- | ------------------------------------ |
| `/fs`              | Nextcloud        | FilePicker — opérations fichiers     |
| `/navigation.json` | Portail Nubus    | Navigation centrale                  |
| `/nob`             | Nordeck (Matrix) | Visioconférence depuis le calendrier |
| `/wiki`            | XWiki            | Fil d'actualités du portail          |

#### Le FilePicker openDesk

Le FilePicker Nextcloud est intégré dans OX App Suite pour : attacher des fichiers Nextcloud aux emails, insérer des liens Nextcloud dans les emails, sauvegarder des pièces jointes dans Nextcloud, attacher des fichiers aux entrées de calendrier. 
IL faut donc rajouter le code du composant de file picker de chaque app cible. Par ex ici l'[addon dans Open Xchange pour disposer d'un front Next Cloud](https://gitlab.open-xchange.com/extensions/nextcloud-integration/-/tree/main).

**Deux chemins d'intégration :**

- **Frontend** — Le JS d'OX App Suite appelle les endpoints ICS (`/fs`), qui proxie vers l'API Nextcloud avec les tokens OIDC appropriés
- **Backend** — Le middleware OX communique directement avec l'API Nextcloud pour les transferts de fichiers volumineux (évite de faire transiter les données par le navigateur)

**Conséquences**
- l'app appelante dispose de tous les droits de l'utilisateur sur l'applicatoin cible (pas de zero trust)
- l'ICS a tout les droits sur toutes les données de tous les utilisateurs de l'application cible (pas de zero trust)
- il faut modifier les clients des app appelantes pour y mettre les composants graphiques du File picker de l'app cible, ce qui génère des poinst d'attention sur la gestion des routes, de mise à jour des composants, de coordination des version entre le FP dans l'app appelante et l'app cible.


**Ressources openDesk :**

| Ressource                             | URL                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| Architecture openDesk                 | https://docs.opendesk.eu/operations/architecture/#filepicker                 |
| UI de l'intégration Nextcloud dans OX | https://gitlab.open-xchange.com/extensions/nextcloud-integration/-/tree/main |
| Documentation Intercom Service        | https://docs.software-univention.de/intercom-service/latest/index.html       |
| Code source Intercom Service          | https://github.com/univention/intercom-service                               |

### 2.5 Google Picker API (référence propriétaire)

L'API Google Picker est l'implémentation propriétaire la plus mature d'un File Picker web. Bien qu'elle soit fermée et couplée à l'écosystème Google, sa conception — affinée sur plus de dix ans — est une source d'inspiration précieuse pour la sémantique, la structure de réponse, et les patterns UX d'Open Buro.

#### 2.5.1 Principe général

Le Google Picker se présente comme une boîte de dialogue « File Open » modale, rendue en overlay dans l'application appelante. Il permet aux utilisateurs de parcourir, rechercher et sélectionner des fichiers depuis Google Drive (et historiquement Photos, YouTube, Maps). L'app appelante reçoit en retour un objet structuré décrivant le(s) fichier(s) sélectionné(s).

Deux modes de distribution existent :
- **Web apps** — Le picker s'affiche en modale inline (iframe) dans la page de l'app appelante
- **Desktop apps** (beta) — Le picker s'ouvre dans un nouvel onglet du navigateur, avec retour par callback URL

Un web component (`@googleworkspace/drive-picker-element`) et un composant React (`@googleworkspace/drive-picker-react`) simplifient l'intégration.

#### 2.5.2 Architecture : le pattern Builder

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

#### 2.5.3 Concepts clés

**Views (Vues)** — Le picker peut afficher différentes « vues » de contenu, que l'app cliente choisit :

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

**Features (Options)** — Des flags activables/désactivables sur le picker :

| Feature                 | Effet                                        |
| ----------------------- | -------------------------------------------- |
| `MULTISELECT_ENABLED`   | Sélection multiple                           |
| `MINE_ONLY`             | N'afficher que les fichiers de l'utilisateur |
| `NAV_HIDDEN`            | Masquer la barre de navigation               |
| `SIMPLE_UPLOAD_ENABLED` | Activer l'upload de fichiers                 |
| `SUPPORT_DRIVES`        | Inclure les drives partagés                  |

**Pertinence pour Open Buro :** Les features `MULTISELECT_ENABLED` et `MINE_ONLY` correspondent directement aux paramètres `multiple` et potentiellement `scope` proposés dans notre spec. `SIMPLE_UPLOAD_ENABLED` correspond au mode `SAVE`.

#### 2.5.4 Authentification

Le Google Picker exige un **token OAuth 2.0** de l'utilisateur, passé via `setOAuthToken()`. C'est l'app cliente qui est responsable d'obtenir ce token (via le flux OAuth standard) puis de le transmettre au picker. Le picker ne fait pas d'authentification lui-même.

La portée requise est `drive.file` (accès limité aux fichiers sélectionnés ou créés par l'app, sans accès à l'intégralité du Drive).

**Leçon pour Open Buro :** Ce modèle est instructif mais lourd — il nécessite un SSO / OAuth entre l'app cliente et Google. Pour le hackathon, l'approche « sessions pré-existantes indépendantes » est bien plus pragmatique. En production, un mécanisme de token exchange médié par la plateforme (comme le fait l'ICS d'openDesk) serait préférable.

#### 2.5.5 Structure de la réponse (callback)

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

#### 2.5.6 Upload (mode SAVE)

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

#### 2.5.7 Synthèse : ce que le Google Picker enseigne à Open Buro

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

Ces enseignements nourrissent directement la spec proposée au §4.4.

---

## 3. Tableau Comparatif

### 3.1 Modèle d'intégration

| Dimension                     | Android                                    | freedesktop                        | Cozy / Twake                             | OpenDesk                           |
| ----------------------------- | ------------------------------------------ | ---------------------------------- | ---------------------------------------- | ---------------------------------- |
| **Déclaration des capacités** | `<intent-filter>` dans AndroidManifest.xml | Fichier `.desktop` avec `MimeType` | `intents` dans le manifest JSON de l'app | Aucune — intégrations hardcodées   |
| **Résolution**                | Système parcourt tous les intent-filters   | `xdg-open` / `xdg-mime`            | Stack parcourt les manifests installés   | N/A (routes ICS statiques)         |
| **Canal de communication**    | IPC natif (Binder)                         | D-Bus                              | `window.postMessage` via iframe          | HTTP proxy (ICS)                   |
| **Multi-provider**            | Oui (chooser dialog)                       | Oui (app par défaut configurable)  | Oui (liste de services + chooser)        | Non (Nextcloud uniquement)         |
| **Auth**                      | Permissions Android                        | Portails Flatpak                   | pas besoin                               | OIDC tokens via ICS                |
| **Transfert de données**      | Intent extras + Content Providers          | D-Bus / fichiers partagés          | postMessage (base64 ou ref document)     | Backend HTTP (fichiers volumineux) |

### 3.2 Le File Picker spécifiquement

| Aspect                    | Cozy / Twake                                  | openDesk                           | Open Buro (proposé)                                         |
| ------------------------- | --------------------------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| **Déclenchement**         | `cozy.intents.start('PICK', 'io.cozy.files')` | Code frontend OX appelle ICS `/fs` | App cliente appelle plateforme `/resolve` puis ouvre iframe |
| **Découverte du service** | Dynamique (manifests)                         | Hardcodé (ICS → Nextcloud)         | Dynamique (registre de capabilities)                        |
| **UI du picker**          | App Drive dans iframe                         | Composant Nextcloud dans OX        | Chaque drive fournit son propre front                       |
| **Auth**                  | Stack gère les tokens                         | ICS silent OIDC login              | Sessions pré-existantes (hackathon)                         |
| **Retour**                | postMessage « completed » + doc JSON          | Réponse HTTP via ICS               | postMessage avec sémantique à définir                       |
| **Fichiers volumineux**   | Base64 dans postMessage (limité)              | Backend-to-backend (scalable)      | URL avec token intégré (proposé)                            |
| **Extensibilité**         | Toute app déclarant PICK sur io.cozy.files    | Nécessite nouveau endpoint ICS     | Toute source inscrivant la capability                       |

### 3.3 Mapping des concepts

| Concept Android            | Cozy Cloud                         | openDesk                  | Open Buro (proposé)                  |
| -------------------------- | ---------------------------------- | ------------------------- | ------------------------------------ |
| `<intent-filter>`          | `intents` dans manifest            | *(pas d'équivalent)*      | Capability dans le registre          |
| `action` (PICK)            | `action` (PICK)                    | Endpoint ICS (`/fs`)      | `action` (PICK)                      |
| `data` / MIME type         | `type` (MIME ou doctype)           | Implicite dans l'endpoint | `type` (files, images…)              |
| `startActivityForResult()` | `cozy.intents.start().then()`      | JS appelle ICS + callback | `lib.resolve().open().then()`        |
| Chooser dialog             | PICK secondaire sur `io.cozy.apps` | *(N/A)*                   | Multi-capabilities dans le résolveur |
| `onActivityResult()`       | `service.terminate(doc)`           | Réponse ICS               | postMessage callback                 |

---

## 4. Proposition pour le Hackathon

### 4.1 Principes

* **client** : application appelante : dispose d'une librairie "ob_bridge" qui expose une api pour appeler le FP et avoir un call back avec le retour.
* **ob_bridge** : librairie en charge de :
  * connaitre les capabilities disponibles sur la plateforme
  * résoudre un intent en capabilitie (resolver + chooser)
  * pilotage de l'iframe de la capability sur son cycle de vie (dimensionnement, gestion des messages bi-directionnels...)
* **service** : application cible : expose ses capabilities dans son manifest
* **domaines et sessions** : les applications clientes et cibles sont sur des domaines disctincts, avec leur propres sessions (possiblement via un SSO commun). 
  * De cette façon il y a une étanchéité totale entre les services, aucun sujet d'autautorisation 
* **Discovery** : 
  * la liste des capabilities est fournie par un serveur basique ("open buro server), sans authentification, exposant les capabilities des applications de la plateforme.
  * **Alternative ultra-minimaliste :** une simple variable d'environnement avec `drive.example.com/pick` — fonctionnel mais statique, et comme il y aura besoin d'un service plateforme, autant s'appuyer dessus, à discuter.
* **binaire** : si l'app cliente demande le transfert du contenu binaire : à elle de faire un fetch sur les liens retournés plutot que de faire transiter les binaires par l'iframe (pré requis : le service doit savoir produire une url de téléchargement sécurisé)

A noter que cette approche zero trust évite des sujets difficile :
1. **Authentification** — L'utilisateur dispose déjà de sessions web ouvertes sur les trois services (app cliente, source/drive, plateforme), chacun sur son propre domaine. Pas de SSO ni de token exchange. Pour le hackathon, il est possible de contourner les sécurité du navigateur (CSP, same-origin) via des extensions browser.
2. **Droits** — Pas d'interaction directe entre l'app cliente et la source. Si le File Picker retourne un lien plutôt qu'un fichier, l'URL intègre le token selon la stratégie propre au drive — pas besoin de normaliser l'accès, juste la réponse HTTP.

**Architecture des fronts** — Deux scénarios compatibles coexisteront. Chaque éditeur choisit, tout en respectant le protocole File Picker :

| Scénario         | Description                                                                              | Avantage                                |
| ---------------- | ---------------------------------------------------------------------------------------- | --------------------------------------- |
| **1 — Direct**   | L'app cliente ouvre elle-même l'iframe vers la capability et dialogue en postMessage     | Simple, autonome                        |
| **2 — Coquille** | Le service client échange avec son app « coquille », qui ouvre l'iframe de la capability | Cohérent avec l'approche Twake actuelle |

### 4.2 Architecture cible minimale

```
┌──────────────────────────────────────────────────────────────┐
│                        NAVIGATEUR                            │
│                                                              │
│  ┌──────────────────┐           ┌─────────────────────────┐  │
│  │   App Cliente    │           │   iframe: File Picker   │  │
│  │   (Tmail, Docs)  │◀════════▷ │   (TDrive, Fichiers…)   │  │
│  │                  │postMessage│                         │  │
│  │ Session active A │           │   Session active B      │  │
│  └────────┬─────────┘           └─────────┬───────────────┘  │
│           │                               │                  │
└───────────┼───────────────────────────────┼──────────────────┘
            │ GET /resolve                  │                     
            ▼                               ▼                    
     ┌────────────────────┐        ┌──────────────────┐
     │  Plateforme        │        │  Service cible   │
     │  (Open Buro server)│        │  (drive)         │
     │  registry.json     │        │                  │
     └────────────────────┘        └──────────────────┘
```


### 4.4 Sémantique du File Picker Intent (DRAFT ALPHA)

#### Paramètres de l'intent (client → service, via query string ou postMessage init)

| Paramètre  | Type     | Description                                                      |
| ---------- | -------- | ---------------------------------------------------------------- |
| `action`   | string   | `PICK` (sélectionner) ou `SAVE` (déposer)                        |
| `type`     | string   | `files` — extensible à `images`, `documents`, etc.               |
| `multiple` | boolean  | Autoriser la sélection de plusieurs fichiers                     |
| `accept`   | string[] | Filtres MIME optionnels (ex. `["image/*", "application/pdf"]`)   |
| `data`     | object   | Données additionnelles (ex. pour SAVE : `{ content, filename }`) |

#### Réponse de l'intent (service → client, via postMessage)

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

#### Codes d'erreur proposés

| Code                | Signification                                 |
| ------------------- | --------------------------------------------- |
| `user_cancelled`    | L'utilisateur a fermé le picker               |
| `permission_denied` | Droits insuffisants                           |
| `not_found`         | Fichier introuvable                           |
| `size_exceeded`     | Fichier trop volumineux pour un retour base64 |
| `unknown`           | Erreur non catégorisée                        |

### 4.5 Protocole postMessage détaillé (DRAFT ALPHA)

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

### 4.6 Contournements navigateur pour le hackathon (TBC)

| Problème                                                              | Solution dev hackathon                                                                                        |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Cookies non partagés** entre app et iframe (Same-Site)              | Firefox : désactiver Enhanced Tracking Protection                                                             |
| **CSP frame-src / frame-ancestors** empêchant le chargement en iframe | Extension « CSP Unblock » (Firefox / Chrome)                                                                  |
| **CORS headers**                                                      | Chrome sur macOS : `open -na "Google Chrome" --args --disable-web-security --user-data-dir="/tmp/chrome_dev"` |

---

## 5. Sujets de réflexion pour les ateliers

Ces questions structurent les discussions techniques du hackathon :

### 5.1 Sémantique de l'intent-filter / capability

- Quels verbes d'action standardiser au-delà de `PICK` et `SAVE` ? (`VIEW`, `EDIT`, `CREATE`, `SHARE` ?)
- Comment typer les données ? MIME types purs, types domaine (comme `io.cozy.files`), ou un vocabulaire Open Buro dédié ?
- Faut-il supporter des catégories (comme Android) ou le couple action/type suffit-il ?

### 5.2 Processus de récupération des intent-filters / capability

- Cache côté client ? Durée de vie ?
- Source unique (registre plateforme) ou fédéré (chaque app expose son manifest) ?
- Gestion du multi-intent-filter : que se passe-t-il quand 3 drives déclarent `PICK files` ?
- UX du chooser : l'app cliente gère-t-elle le choix, ou la plateforme fournit-elle un composant ?

### 5.3 Ouverture & initialisation de l'intent

- URL complète dans le registre ou base URL + route ?
- Paramètres passés en query string, dans le hash, ou uniquement via postMessage ?
- iframe vs nouvel onglet vs popup ? Contraintes UX et techniques de chacun
- Taille et positionnement de l'iframe (modale, panneau latéral, plein écran ?)

### 5.4 Communication client & intent-filter

- Protocole postMessage : quels types de messages au-delà de ready/init/done/error ?
- Progress : le service peut-il notifier une progression (upload en cours, etc.) ?
- Sécurité : validation d'origin, protection contre le spoofing de messages
- Timeout : que faire si le service ne répond pas ?

### 5.5 Cycle de vie du front de l'intent-filter

- Le service fournit-il une UI complète ou un composant embarquable ?
- Responsive : le front du picker doit-il s'adapter à la taille de l'iframe ?
- `intent:resize` : le service peut-il demander un redimensionnement ?
- Theming : le picker doit-il respecter le thème de l'app cliente ?

### 5.6 Callback & résultat

- Retour par référence (URL/lien de partage) vs retour par valeur (contenu base64) ?
- Pour les liens : qui gère l'expiration du token ? Le drive, selon sa propre stratégie
- Pour le contenu : limite de taille raisonnable pour base64 dans postMessage ?
- Métadonnées minimales dans la réponse : `name`, `mimeType`, `size`, `url` — quoi d'autre ?

### 5.7 Sécurité (CORS, CSP, et au-delà)

- En production : comment gérer CSP `frame-ancestors` sans tout ouvrir ?
- La plateforme doit-elle fournir une liste blanche de domaines autorisés en iframe ? comment les connaitres ?
- Protection contre le clickjacking quand le picker est en iframe
- Persistent intent-filters : un intent peut-il rester ouvert (ex. sync continue, ou pour ouverture plus rapide) ?


---

## 7. Annexes

### 7.1 Bibliographie & art antérieur

| Source                                                                                                                    | Pertinence                                                  |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [Android Intents & Intent Filters](https://developer.android.com/guide/components/intents-filters)                        | Modèle de référence                                         |
| [Cozy Stack Intents](https://docs.cozy.io/en/cozy-stack/intents/)                                                         | Implémentation web la plus proche (avec défaut connus :-) ) |
| [Mozilla WebActivities (archivé)](https://wiki.mozilla.org/WebAPI/WebActivities)                                          | Prédécesseur historique                                     |
| [W3C Web Intents (abandonné)](http://webintents.org/)                                                                     | Tentative de standardisation W3C                            |
| [openDesk Architecture](https://docs.opendesk.eu/operations/architecture/)                                                | Approche proxy sans intents                                 |
| [Univention Intercom Service](https://docs.software-univention.de/intercom-service/latest/architecture.html)              | Backend-for-frontend proxy                                  |
| [freedesktop.org Desktop Entries](https://specifications.freedesktop.org/desktop-entry-spec/latest/)                      | Capabilities Linux                                          |
| [D-Bus FileChooser Portal](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.FileChooser.html) | Sémantique file picker sandboxé                             |
| [Google Picker API](https://developers.google.com/drive/picker)                                                           | Référence sémantique commerciale                            |
| [Cozy Forum: Inter-app communication](https://forum.cozy.io/t/cozy-tech-topic-inter-app-communication-architecture/2287)  | Historique des discussions Cozy                             |
| [Apple SiriKit Intents](https://developer.apple.com/documentation/sirikit)                                                | Modèle iOS                                                  |


### 7.3 Glossaire

| Terme                | Définition                                                                        |
| -------------------- | --------------------------------------------------------------------------------- |
| **Intent**           | Requête d'une app pour qu'une autre app réalise une action sur un type de données |
| **Capability**       | Déclaration par une app de sa capacité à gérer un type d'intent                   |
| **Intent-filter**    | Synonyme de capability dans le vocabulaire Android                                |
| **Client**           | L'app qui initie l'intent                                                         |
| **Service / Source** | L'app qui résout l'intent (fournit le service)                                    |
| **Plateforme**       | Couche d'orchestration qui met en relation clients et services                    |
| **Coquille**         | App « shell » qui héberge un ou plusieurs services dans un cadre plateforme       |
| **Registre**         | Stockage des capabilities déclarées par les services                              |
| **Résolveur**        | Mécanisme qui matche un intent avec les capabilities disponibles                  |

---

*Document préparé pour le hackathon Open Buro — Avril 2026*
*Sources : documentation openDesk, Cozy Stack, Android, freedesktop.org, et notes de préparation internes*
