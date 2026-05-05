---
layout: default
title: Workshop Topics
parent: Frontend Approach
nav_order: 4
lang_alt_url: /fr/proposition-hackathon/sujets-ateliers/
---

# Workshop Discussion Topics

[← Browser Workarounds](browser-workarounds.md) · [Frontend Approach](index.md) · [Home](../index.md)

---

These questions structure the technical discussions of the hackathon:

## Capability Semantics in App Manifests

- Which action verbs should be standardized beyond `PICK` and `SAVE`? (`VIEW`, `EDIT`, `CREATE`, `SHARE`?)
- How should data be typed? Plain MIME types, domain types (such as `io.cozy.files`), or a dedicated Open Buro vocabulary?
- Do we need to support categories (like Android), or is the action/type pair enough?

**Choice for the tech sprint:**

```json
{
    id: ""
    name: ""
    url: ""
    version: ""
    capabilities: [
        {
            action: "PICK"
            properties: {
                mimeTypes: ["*/*"], // file picker can offer these files
                multiple: boolean   // file picker can return multiple
            }
            path: ""
        },
        {
            action: "SAVE",
            properties: {
                mimeTypes: ["*/*"],
                multiple: boolean
            },
            path: ""
        }
    ]
}
```

## Capability Retrieval Process

- Client-side cache? TTL?
- Single source (platform registry) or federated (each app exposes its manifest)?
- Multi-capability handling: what happens when 3 drives declare `PICK files`?
- Chooser UX: does the calling app handle the selection, or does the platform provide a component?

**Choice for the tech sprint:**
* The calling app tells the SDK the URL where the manifest array can be fetched
* `ob_sdk.init({manifests: string | obj})`

## Intent Management: Capability Lifecycle

- Parameters passed in the query string, in the hash, or only via postMessage?
- iframe vs new tab vs popup? UX and technical constraints of each
- Iframe size and placement (modal, side panel, full screen?)

**Choice for the tech sprint:**
* init parameters are sent in the query string
* iframe
* modal with a fixed size
```
?clientUrl= // for the targetOrigin
&id= // to avoid conflicts when several pickers run across several tabs; must then be passed in every postMessage
&type= // ,-separated: sharingUrl | downloadUrl | payload — choose between links, binaries, or both as the return
&allowedMimeType= // ,-separated: filters the files displayed by the file picker; see MIME types on MDN
&multiple=boolean // default = false
```

## Communication Between Client & Iframe

- postMessage protocol: which message types beyond ready/init/done/error?
- Progress: can the service signal progress (upload in progress, etc.)?
- Timeout: what to do if the service does not respond?

**Choice for the tech sprint:**
* No communication during the lifecycle other than init and the final callback

## Callback & Result

- Return by reference (URL / share link) vs return by value (base64 content)?
- For links: who handles token expiration? The drive, according to its own strategy
- For content: a reasonable size limit for base64 in postMessage?
- Minimal metadata in the response: `name`, `mimeType`, `size`, `url` — what else?

**Choice for the tech sprint:**
```
{
    status: done,
    id: string,
    // allow multi-file selection
    results: [
        // allow getting both types from a file
        {
            name: string
            mimeType: string
            size: number // bytes
            sharingUrl?: string
            downloadUrl?: string
            payload?: any
        }
    ]
}
```

```
{
    "status": "error",
    id: string,
    "message": string
}
```

## Security (CORS, CSP, and Beyond)

- In production: how do we manage CSP `frame-ancestors` without opening everything?
- Should the platform provide an allowlist of domains permitted in iframe? How would they be known?
- Security: origin validation, protection against message spoofing
- Protection against clickjacking when the picker is in an iframe
- Persistent capabilities: can an intent stay open (e.g., continuous sync, or for faster reopening)?

service CSP ≠ iframe CSP

**Choice for the tech sprint:**
* The service must hold the list of URLs allowed to call it ⇒ v1 hardcoded, v2 client manifest, vX OpenBuro server
* The client must hold the list of URLs it can embed ⇒ derived from the manifest
* targetOrigin = the client passes the client URL in the init query string to prevent the iframe from navigating the parent
* Clickjacking = no concern if CSP is in place — to confirm

**Not prioritized**
Persistent capabilities: would require postMessage init, not needed for the POC

---

[Next: Backend Approach →](../backend-approach/)
