---
layout: default
title: Demo
parent: Backend approach
nav_order: 3
lang_alt_url: /en/backend-approach/demo/
---

# Backend approach: demo

[← Backend approach](./index.md) · [Accueil](../index.md)

---

## OpenBuro router

We developed a POC server that can act as a proxy exposing the OpenBuro file
picker API for services that are not natively integrated with OpenBuro.

Source code of the project is available at:
[github.com/openburo/openburo-router](https://github.com/openburo/openburo-router)

You will find a back-end with different connectors to:

- Twake
- Google Drive 
- Jamespot
- Nextcloud

And also a front-end to showcase the integration.

> Note that only API server and connectors have been developed during this
> first technical sprint. OIDC resource server and authorization server
> implementations have been bypassed on purpose.
