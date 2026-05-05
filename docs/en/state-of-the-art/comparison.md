---
layout: default
title: Comparison Table
parent: State of the Art
nav_order: 6
lang_alt_url: /fr/etat-de-lart/comparatif/
---

# Comparison Table

[← Google Picker](google-picker.md) · [State of the Art](index.md) · [Home](../index.md)

---

## Integration Model

| Dimension                       | Android                                    | freedesktop                              | Cozy / Twake                              | openDesk                              |
| ------------------------------- | ------------------------------------------ | ---------------------------------------- | ----------------------------------------- | ------------------------------------- |
| **Capability declaration**      | `<intent-filter>` in AndroidManifest.xml   | `.desktop` file with `MimeType`          | `intents` in the app's JSON manifest      | None — hardcoded integrations         |
| **Resolution**                  | System walks through all intent filters    | `xdg-open` / `xdg-mime`                  | Stack walks through installed manifests   | N/A (static ICS routes)               |
| **Communication channel**       | Native IPC (Binder)                        | D-Bus                                    | `window.postMessage` via iframe           | HTTP proxy (ICS)                      |
| **Multi-provider**              | Yes (chooser dialog)                       | Yes (default app is configurable)        | Yes (list of services + chooser)          | No (Nextcloud only)                   |
| **Auth**                        | Android permissions                        | Flatpak portals                          | not required                              | OIDC tokens via ICS                   |
| **Data transfer**               | Intent extras + Content Providers          | D-Bus / shared files                     | postMessage (base64 or document ref)      | HTTP backend (large files)            |

## File Picker Specifically

| Aspect                       | Cozy / Twake                                  | openDesk                                | Open Buro (proposed)                                          |
| ---------------------------- | --------------------------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| **Trigger**                  | `cozy.intents.start('PICK', 'io.cozy.files')` | OX frontend code calls ICS `/fs`        | Client app calls platform `/resolve`, then opens an iframe    |
| **Service discovery**        | Dynamic (manifests)                           | Hardcoded (ICS → Nextcloud)             | Dynamic (capability registry)                                 |
| **Picker UI**                | Drive app in an iframe                        | Nextcloud component in OX               | Each drive provides its own front-end                         |
| **Auth**                     | Stack handles tokens                          | ICS silent OIDC login                   | Pre-existing sessions (hackathon)                             |
| **Return**                   | postMessage "completed" + JSON document       | HTTP response via ICS                   | postMessage with semantics to be defined                      |
| **Large files**              | Base64 in postMessage (limited)               | Backend-to-backend (scalable)           | URL with embedded token (proposed)                            |
| **Extensibility**            | Any app declaring PICK on io.cozy.files       | Requires a new ICS endpoint             | Any source registering the capability                         |

## Concept Mapping

| Android concept            | Cozy Cloud                          | openDesk                    | Open Buro (proposed)                   |
| -------------------------- | ----------------------------------- | --------------------------- | -------------------------------------- |
| `<intent-filter>`          | `intents` in manifest               | *(no equivalent)*           | Capability in the registry             |
| `action` (PICK)            | `action` (PICK)                     | ICS endpoint (`/fs`)        | `action` (PICK)                        |
| `data` / MIME type         | `type` (MIME or doctype)            | Implicit in the endpoint    | `type` (files, images…)                |
| `startActivityForResult()` | `cozy.intents.start().then()`       | JS calls ICS + callback     | `lib.resolve().open().then()`          |
| Chooser dialog             | Secondary PICK on `io.cozy.apps`    | *(N/A)*                     | Multi-capabilities in the resolver     |
| `onActivityResult()`       | `service.terminate(doc)`            | ICS response                | postMessage callback                   |

---

[Next: Frontend Approach →](../hackathon-proposal/)
