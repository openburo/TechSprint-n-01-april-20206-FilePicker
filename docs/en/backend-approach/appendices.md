---
layout: default
title: Appendices
parent: Backend Approach
nav_order: 4
lang_alt_url: /fr/backend-approach/appendices/
---

# Backend Approach: Appendices

[← Backend Approach](./index.md) · [Home](../index.md)

---

## The Token Exchange Flow (RFC 8693)

1. **Initial Authentication**
   - The end-user authenticates with the **Primary IdP**, which issues an initial **access token** or **ID token**.

2. **Token Exchange Request**
   - The client application sends the initial token to the **Token Exchange Service**, requesting a new token for a specific **target resource** or **audience**.
   - The request includes:
     - `grant_type=urn:ietf:params:oauth:grant-type:token-exchange`
     - `subject_token`: the initial token.
     - `subject_token_type`: the type of the initial token (e.g., `urn:ietf:params:oauth:token-type:access_token`).
     - `audience`: the target resource or service.
     - `scope`: the requested permissions for the new token.

3. **Token Transformation**
   - The **Token Exchange Service** validates the initial token and issues a new token tailored for the target resource. This new token may have:
     - Restricted scopes.
     - Additional claims.
     - A different audience or issuer.

4. **Access to Resource Server**
   - The client application uses the exchanged token to access the **Resource Server**, which validates the token and grants access based on its claims and scopes.
