---
layout: default
title: Google Picker API
parent: State of the Art
nav_order: 5
lang_alt_url: /fr/etat-de-lart/google-picker/
---

# Google Picker API (Proprietary Reference)

[← openDesk](opendesk.md) · [State of the Art](index.md) · [Home](../index.md)

---

The Google Picker API is the most mature proprietary implementation of a web File Picker. While it is closed and tied to the Google ecosystem, its design — refined over more than a decade — is a valuable source of inspiration for Open Buro's semantics, response structure, and UX patterns.

## General Principle

The Google Picker behaves as a modal "File Open" dialog, rendered as an overlay inside the calling application. It lets users browse, search, and select files from Google Drive (and historically from Photos, YouTube, Maps). The calling app receives a structured object describing the selected file(s).

Two distribution modes exist:
- **Web apps** — The picker is shown as an inline modal (iframe) within the calling app's page
- **Desktop apps** (beta) — The picker opens in a new browser tab, with results returned via a callback URL

A web component (`@googleworkspace/drive-picker-element`) and a React component (`@googleworkspace/drive-picker-react`) simplify integration.

## Architecture: The Builder Pattern

The Picker uses a **Builder pattern** for configuration. The client app does not manipulate the iframe directly — it describes what it wants via `PickerBuilder`, which produces a `Picker` object that encapsulates all display and communication logic.

```javascript
const picker = new google.picker.PickerBuilder()
    .setOAuthToken('TOKEN_FOR_USER')       // User's OAuth2 token
    .setAppId('1234567890')                 // Cloud project number
    .setDeveloperKey('AIza...')             // API key
    .addView(google.picker.ViewId.DOCS)     // Initial view
    .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
    .setCallback(pickerCallback)            // Callback function
    .setLocale('en')                        // UI language
    .setMaxItems(10)                        // Max number of files
    .setSelectableMimeTypes('image/png,application/pdf')
    .setTitle('Select a file')
    .setSize(800, 600)                      // Modal size
    .build();

picker.setVisible(true);                    // Show the picker
```

**Lesson for Open Buro:** The Builder pattern is powerful but assumes a single client-side SDK. For an open standard, it is preferable for these parameters to be passed via the URL or postMessage, so as to remain framework-agnostic. That said, providing a library exposing an API to ease interaction with the component is a useful implementation enabler.

## Key Concepts

### Views

The picker can display different content "views" that the client app chooses from:

| ViewId            | Description                              |
| ----------------- | ---------------------------------------- |
| `DOCS`            | All Google Drive files                   |
| `DOCS_IMAGES`     | Images only                              |
| `DOCS_VIDEOS`     | Videos only                              |
| `DOCUMENTS`       | Text documents (Google Docs)             |
| `SPREADSHEETS`    | Spreadsheets                             |
| `PRESENTATIONS`   | Presentations                            |
| `PDFS`            | PDF files                                |
| `FOLDERS`         | Folder navigation (folder selection)     |
| `RECENTLY_PICKED` | Recently picked files                    |

The app can stack several views, creating navigation tabs in the picker. It can also use `DocsView` for finer control: filtering by owner, navigating from a given parent folder, enabling folder selection, and so on.

**Relevance for Open Buro:** The concept of views is interesting but too tightly coupled to Google Drive. For an open standard, MIME filters and `accept` parameters are enough — it is up to the service (Drive) to decide how to surface them in its UI.

### Features

Toggleable flags on the picker:

| Feature                 | Effect                                    |
| ----------------------- | ----------------------------------------- |
| `MULTISELECT_ENABLED`   | Multi-selection                           |
| `MINE_ONLY`             | Show only the user's own files            |
| `NAV_HIDDEN`            | Hide the navigation bar                   |
| `SIMPLE_UPLOAD_ENABLED` | Enable file upload                        |
| `SUPPORT_DRIVES`        | Include shared drives                     |

**Relevance for Open Buro:** The `MULTISELECT_ENABLED` and `MINE_ONLY` features map directly to the `multiple` and possibly `scope` parameters proposed in our spec. `SIMPLE_UPLOAD_ENABLED` corresponds to the `SAVE` mode.

## Authentication

The Google Picker requires an **OAuth 2.0 token** from the user, passed through `setOAuthToken()`. The client app is responsible for obtaining this token (via the standard OAuth flow) and passing it to the picker. The picker does not perform authentication itself.

The required scope is `drive.file` (limited access to files selected or created by the app, with no access to the entire Drive).

**Lesson for Open Buro:** This model is instructive but heavy — it requires SSO / OAuth between the client app and Google. For the hackathon, the "independent pre-existing sessions" approach is far more pragmatic. In production, a token-exchange mechanism mediated by the platform (as openDesk's ICS does) would be preferable.

## Response Structure (Callback)

When the user interacts with the picker, the callback receives a structured `ResponseObject`:

```javascript
function pickerCallback(data) {
  if (data.action === google.picker.Action.PICKED) {
    // One or more selected files
    const documents = data.docs;
    documents.forEach(doc => {
      console.log('ID:', doc.id);
      console.log('Name:', doc.name);
      console.log('MIME:', doc.mimeType);
      console.log('URL:', doc.url);
      console.log('Size:', doc.sizeBytes);
      console.log('Last edit:', doc.lastEditedUtc);
      console.log('Embed URL:', doc.embedUrl);
      console.log('Download URL:', doc.downloadUrl);
      console.log('Thumbnails:', doc.thumbnails);
      console.log('Parent ID:', doc.parentId);
      console.log('Read only:', doc.readOnly);
      console.log('Shared:', doc.isShared);
    });
  } else if (data.action === google.picker.Action.CANCEL) {
    console.log('User cancelled');
  }
}
```

**Possible response actions:**

| Action   | Meaning                                          |
| -------- | ------------------------------------------------ |
| `PICKED` | The user selected one or more files              |
| `CANCEL` | The user cancelled / closed the picker           |
| `ERROR`  | An error occurred                                |

**`DocumentObject` properties:**

| Property        | Type    | Description                                        |
| --------------- | ------- | -------------------------------------------------- |
| `id`            | string  | Unique file identifier                             |
| `name`          | string  | File name                                          |
| `mimeType`      | string  | MIME type                                          |
| `url`           | string  | URL to the file in Drive                           |
| `downloadUrl`   | string  | Direct download URL                                |
| `embedUrl`      | string  | Embed URL (iframe)                                 |
| `sizeBytes`     | number  | Size in bytes                                      |
| `lastEditedUtc` | number  | Last-modified timestamp                            |
| `iconUrl`       | string  | URL of the file-type icon                          |
| `description`   | string  | File description                                   |
| `parentId`      | string  | Parent folder ID                                   |
| `isNew`         | boolean | File just uploaded                                 |
| `isShared`      | boolean | Shared file                                        |
| `readOnly`      | boolean | Read-only                                          |
| `thumbnails`    | array   | Thumbnails (url, width, height, type)              |
| `type`          | enum    | `DOCUMENT`, `PHOTO`, `VIDEO`                       |
| `audience`      | enum    | `LIMITED`, `DOMAIN_PUBLIC`, `PUBLIC`, `OWNER_ONLY` |
| `serviceId`     | enum    | Identifies the source service (`DOCS`)             |

**Key lesson for Open Buro:** This response structure is the product of more than ten years of iteration. The essential fields to keep for our spec are:

| Google Picker          | Open Buro proposal                          | Priority  |
| ---------------------- | ------------------------------------------- | --------- |
| `id`                   | `id`                                        | Essential |
| `name`                 | `name`                                      | Essential |
| `mimeType`             | `mimeType`                                  | Essential |
| `url`                  | `url` (with embedded token if needed)       | Essential |
| `sizeBytes`            | `size`                                      | Useful    |
| `downloadUrl`          | Embedded into `url`                         | Useful    |
| `embedUrl`             | Not for the hackathon                       | Future    |
| `thumbnails`           | Not for the hackathon                       | Future    |
| `lastEditedUtc`        | Not for the hackathon                       | Future    |
| `isShared`, `audience` | Not relevant (drive-specific strategy)      | —         |

## Upload (SAVE Mode)

The Google Picker also offers a `DocsUploadView` to **save** a file into a Drive folder. The client app can pre-configure the destination folder via `setParent()`. This mode is the equivalent of the `SAVE` action in intent terminology.

```javascript
const uploadView = new google.picker.DocsUploadView()
    .setParent('FOLDER_ID')      // Destination folder
    .setIncludeFolders(true);    // Allow navigating into folders

const picker = new google.picker.PickerBuilder()
    .addView(uploadView)
    .setOAuthToken(oauthToken)
    .setCallback(uploadCallback)
    .build();
```

**Relevance for Open Buro:** This confirms that the File Picker must support both modes (`PICK` and `SAVE`), and that `SAVE` mode requires additional input data (file content, name, destination folder).

## Summary: What Google Picker Teaches Open Buro

| Aspect             | Google's approach                                       | Lesson for Open Buro                                                                |
| ------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Integration**    | Proprietary JS SDK + iframe controlled by Google        | Prefer standardized postMessage messages; SDK bridge as an optional convenience     |
| **Configuration**  | Builder pattern with chained methods                    | Parameters in the URL or in the `intent:init` message                               |
| **Auth**           | OAuth2 token passed by the client app to the picker     | Independent sessions                                                                |
| **Response**       | Rich structured object (`DocumentObject`)               | Adopt the core: `id`, `name`, `mimeType`, `url`, `size`                             |
| **Actions**        | `PICKED`, `CANCEL`, `ERROR`                             | Map to `intent:done`, `intent:cancel`, `intent:error`                               |
| **Multi-select**   | Via `Feature.MULTISELECT_ENABLED`                       | Via the `multiple: true` parameter in `intent:init`                                 |
| **MIME filters**   | Via `setSelectableMimeTypes()` or `View.setMimeTypes()` | Via the `accept: ["image/*"]` parameter in `intent:init`                            |
| **Upload/Save**    | Separate `DocsUploadView`                               | `SAVE` action with `data: { content, filename }`                                    |
| **Picker size**    | `setSize(width, height)`                                | `intent:resize` sent by the service, applied by the calling app or SDK bridge       |
| **Localization**   | `setLocale('fr')`                                       | Service responsibility (it knows the user's language)                               |
| **Web component**  | `<drive-picker>` custom element                         | Inspiration for the Open Buro front-end library                                     |

The Google Picker shows that a performant web file picker requires:
* a rich but normalized response structure,
* fine-grained control over accepted MIME types,
* support for multi-select,
* and a clear distinction between pick and upload modes.

These insights feed directly into the [proposed spec](../hackathon-proposal/file-picker-semantics.md).

---

[← openDesk](opendesk.md) · [Next: Comparison Table →](comparison.md)
