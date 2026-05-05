---
layout: default
title: Contournements navigateur
parent: Approche front
nav_order: 3
---

# Contournements navigateur pour le hackathon (TBC)

[← Protocole postMessage](protocole-postmessage.md) · [Approche front](index.md) · [Accueil](../index.md)

---

| Problème                                                              | Solution dev hackathon                                                                                        |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Cookies non partagés** entre app et iframe (Same-Site)              | Firefox : désactiver Enhanced Tracking Protection                                                             |
| **CSP frame-src / frame-ancestors** empêchant le chargement en iframe | Extension « CSP Unblock » (Firefox / Chrome)                                                                  |
| **CORS headers**                                                      | Chrome sur macOS : `open -na "Google Chrome" --args --disable-web-security --user-data-dir="/tmp/chrome_dev"` |

---

[← Protocole postMessage](protocole-postmessage.md) · [Suivant : Sujets de réflexion →](sujets-ateliers.md)
