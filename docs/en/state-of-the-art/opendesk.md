---
layout: default
title: openDesk (ZenDiS)
parent: State of the Art
nav_order: 4
lang_alt_url: /fr/etat-de-lart/opendesk/
---

# openDesk (ZenDiS / German Government)

[← Cozy Cloud / Twake](cozy-twake.md) · [State of the Art](index.md) · [Home](../index.md)

---

openDesk is a sovereign collaborative suite deployed on Kubernetes, made up of: Nubus (IAM), OX App Suite (mail/calendar), Nextcloud (files), Element (Matrix chat), Jitsi (videoconferencing), OpenProject, XWiki, Collabora.

## The Intercom Service (ICS)

openDesk has **no intent system** as such. Instead, the **Intercom Service** (ICS), a Node.js middleware deployed alongside Nubus, acts as a backend-for-frontend proxy to address CORS and cross-app authentication issues.

**How it works:**

1. The frontend of an app (e.g., Open-Xchange) sends requests to the ICS
2. The ICS modifies, authenticates, and forwards the request to the target app's API (e.g., Nextcloud)
3. The ICS returns the response to the calling app
4. For display, each calling app must embed the file picker UI component of the target app (e.g., Nextcloud)
5. The ICS maintains its own OIDC session via a **silent login** (hidden iframe against Keycloak)

**ICS endpoints:**

| Endpoint           | Target           | Usage                                       |
| ------------------ | ---------------- | ------------------------------------------- |
| `/fs`              | Nextcloud        | File Picker — file operations               |
| `/navigation.json` | Nubus portal     | Central navigation                          |
| `/nob`             | Nordeck (Matrix) | Videoconferencing from the calendar         |
| `/wiki`            | XWiki            | Portal news feed                            |

## The openDesk File Picker

The Nextcloud File Picker is integrated into OX App Suite to: attach Nextcloud files to emails, insert Nextcloud links into emails, save attachments to Nextcloud, and attach files to calendar entries.
The file picker component code of each target app must therefore be added — for example, the [Open-Xchange addon that embeds a Nextcloud frontend](https://gitlab.open-xchange.com/extensions/nextcloud-integration/-/tree/main).

**Two integration paths:**

- **Frontend** — The OX App Suite JS calls the ICS endpoints (`/fs`), which proxy to the Nextcloud API with the appropriate OIDC tokens
- **Backend** — The OX middleware talks directly to the Nextcloud API for large file transfers (avoids routing the data through the browser)

**Consequences:**
- The calling app inherits the user's full set of permissions on the target application (no zero trust)
- The ICS holds full access rights to all data of all users on the target application (no zero trust)
- The clients of calling apps must be modified to embed the target app's File Picker UI, which raises concerns around route management, component updates, and version coordination between the FP in the calling app and the target app.

## openDesk Resources

| Resource                                  | URL                                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| openDesk architecture                     | https://docs.opendesk.eu/operations/architecture/#filepicker                 |
| UI of the Nextcloud integration in OX     | https://gitlab.open-xchange.com/extensions/nextcloud-integration/-/tree/main |
| Intercom Service documentation            | https://docs.software-univention.de/intercom-service/latest/index.html       |
| Intercom Service source code              | https://github.com/univention/intercom-service                               |

---

[Next: Google Picker API →](google-picker.md)
