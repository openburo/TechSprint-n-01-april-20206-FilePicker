---
layout: default
title: Backend approach
nav_order: 4
---

# Backend approach

[← Approche front](proposition-hackathon/) · [Accueil](index.md)

---

## Architecture

![Minimal Viable Architecture](openburo-filepicker.drawio.svg)

## Principles

The consumer.com service will use server to server communication using a
specified resource server API to pick files from the openburo-certified
drive.com service.

The Open Buro initiative provides an OpenBuro "router" that acts as a proxy to
drive services that do not implement the resource server API specification.

> The target architecture depicted in the schema illustrates a **federated
> identity and access management system** leveraging **OpenID Connect (OIDC)**
> and the **OAuth 2.0 Token Exchange (RFC 8693)**. This architecture enables
> secure delegation of authentication and authorization across multiple trust
> domains, allowing services to exchange tokens while maintaining strict
> control over access rights and security policies.

---

### Key Components

1. **OpenBuro-specified resource server API** (drive.com or openburo router)
   - Services or APIs that require tokens for access. They validate tokens
   issued by the Token Exchange Service or directly by the IdPs, ensuring that
   only authorized requests are processed.
   - The openburo router acts as a proxy with services that does implement
   expected resources server API endpoints
   - Servers are expected to implement the specified file-picking capability
   (see next section).

2. **Identity Providers (IdPs)**
   - **Primary IdP**: The central identity provider responsible for
   authenticating end-users and issuing initial tokens (e.g., ID tokens, access
   tokens).
   - **Secondary IdPs**: Additional identity providers that may issue tokens
   for specific domains or services, enabling cross-domain authentication and
   authorization.

3. **Token Exchange Service**
   - A dedicated service implementing **RFC 8693 (Token Exchange)**. It acts as
   an intermediary to exchange tokens between different trust domains, ensuring
   that tokens are transformed, restricted, or enriched according to the target
   service’s requirements.

4. **Client Applications (consumer.com)**
   - Applications or services that consume tokens to access resources on behalf
   of users. They interact with the Token Exchange Service to obtain tokens
   with the appropriate scopes and claims for the target resource.

---

### Security Considerations

- **Token Validation**: All tokens must be validated for integrity, issuer,
audience, and expiration.
- **Scope Restriction**: The Token Exchange Service ensures that exchanged
tokens do not grant more privileges than the original token.
- **Audit and Traceability**: All token exchanges are logged for security
auditing and compliance.
- **Consent Management**: User consent is managed transparently, especially
when tokens are exchanged across trust domains.

## Motivations

### Pros 

- This architecture provides a **scalable, secure, and interoperable**
framework for federated identity and access management, leveraging **OIDC** and
**Token Exchange (RFC 8693)**.
- Each service consuming a resource is free to implement it's own UI/UX to
access the resource.

### Cons 

- Proposed architecture relies on a circle of trust: if you share a token with
a third party application, it implies that the later is trustworthy as it will
have access to a user token to perform actions on behalf of users. The token
exchange specification mitigate the scope of possible actions in a limited
time, but does not solve the OIDC resource server trust issue.

## Technical specifications

- [Resource server API](./specification.md)
- [Demo](./demo.md)
- [Appendices](./appendices.md)
