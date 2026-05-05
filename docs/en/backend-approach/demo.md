---
layout: default
title: Demo
parent: Backend Approach
nav_order: 3
lang_alt_url: /fr/backend-approach/demo/
---

# Backend Approach: Demo

[← Backend Approach](./index.md) · [Home](../index.md)

---

## OpenBuro Router

We developed a POC server that can act as a proxy, exposing the OpenBuro file picker API for services that are not natively integrated with OpenBuro.

The project source code is available at: [github.com/openburo/openburo-router](https://github.com/openburo/openburo-router)

You will find a back-end with different connectors to:

- Twake
- Google Drive
- Jamespot
- Nextcloud

And also a front-end to showcase the integration.

> Note that only the API server and the connectors were developed during this first technical sprint. The OIDC resource-server and authorization-server implementations have been bypassed on purpose.
