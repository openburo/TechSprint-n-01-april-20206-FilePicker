---
layout: default
title: Browser Workarounds
parent: Frontend Approach
nav_order: 3
lang_alt_url: /fr/proposition-hackathon/contournements-navigateur/
---

# Browser Workarounds for the Hackathon (TBC)

[← postMessage Protocol](postmessage-protocol.md) · [Frontend Approach](index.md) · [Home](../index.md)

---

| Issue                                                                  | Hackathon dev workaround                                                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Cookies not shared** between app and iframe (Same-Site)              | Firefox: disable Enhanced Tracking Protection                                                                 |
| **CSP frame-src / frame-ancestors** preventing iframe loading          | "CSP Unblock" extension (Firefox / Chrome)                                                                    |
| **CORS headers**                                                       | Chrome on macOS: `open -na "Google Chrome" --args --disable-web-security --user-data-dir="/tmp/chrome_dev"`   |

---

[← postMessage Protocol](postmessage-protocol.md) · [Next: Workshop Topics →](workshop-topics.md)
