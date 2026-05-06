---
layout: default
title: Home
nav_order: 1
lang_alt_url: /fr/
---

# Open Buro — Tech Sprint #1: File Picker

*Prepared for the Open Buro Hackathon — April 2026*

---

## Executive Summary

Open Buro aims to establish an **open standard for orchestrating collaborative services**. The File Picker is the first concrete use case: letting any application (mail, docs, chat, calendar…) ask any drive (TDrive, Fichier DINUM, Nextcloud…) to present a file selection interface, and receive the result in a standardized way.

Conceptually, three layers come into play:

| Layer                       | Role                                                              | Example                                                             |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Client app**              | Requests an action (e.g., "attach a file")                        | Tmail, Docs, Element                                                |
| **Provider / Capability**   | Exposes a service (e.g., "I can present a file picker")           | TDrive, Fichier DINUM                                               |
| **Platform**                | Connects the client to the capability                             | Minimal intent server, or static configuration (e.g., Cozy Stack)   |

**This document presents:**

1. A state-of-the-art review: existing patterns, comparison of implementations
2. The two approaches explored during the tech sprint:
   1. The frontend approach
   2. The backend approach

---

## Table of Contents

1. [State of the Art: Intent & Capability Patterns](state-of-the-art/)
   - [Android Intents](state-of-the-art/android-intents.md)
   - [Freedesktop.org (XDG)](state-of-the-art/freedesktop.md)
   - [Cozy Cloud / Twake Workplace](state-of-the-art/cozy-twake.md)
   - [openDesk (ZenDiS)](state-of-the-art/opendesk.md)
   - [Google Picker API](state-of-the-art/google-picker.md)
   - [Comparison Table](state-of-the-art/comparison.md)
2. [Frontend Approach](hackathon-proposal/)
   - [Workshop Discussion Topics](hackathon-proposal/workshop-topics.md)
   - [File Picker Intent Semantics](hackathon-proposal/file-picker-semantics.md)
   - [Detailed postMessage Protocol](hackathon-proposal/postmessage-protocol.md)
   - [Browser Workarounds](hackathon-proposal/browser-workarounds.md)
3. [Backend Approach](backend-approach/)
   - [Specification](backend-approach/specification.md)
   - [Demo](backend-approach/demo.md)
   - [Appendices](backend-approach/appendices.md)
4. [References](references.md)
5. [Glossary](glossary.md)
