---
layout: default
title: Cozy Cloud / Twake
parent: État de l'art
nav_order: 3
---

# Cozy Cloud / Twake Workplace

[← Freedesktop.org](freedesktop.md) · [État de l'art](index.md) · [Accueil](../index.md)

---

Cozy implémente un système d'intents directement inspiré d'Android, adapté au contexte web.

## Déclaration dans le manifest de l'app

```json
{
  "intents": [
    {
      "action": "PICK",
      "type": ["io.cozy.files", "image/*"],
      "href": "/pick"
    },
    {
      "action": "EDIT",
      "type": ["image/png"],
      "href": "/editor"
    }
  ]
}
```

Chaque intent déclaré contient :

- **`action`** — verbe : `CREATE`, `EDIT`, `OPEN`, `PICK`, `SHARE` (liste extensible)
- **`type`** — un ou plusieurs types de données (MIME ou doctype Cozy comme `io.cozy.files`)
- **`href`** — route relative dans l'app qui gère cet intent

## Cycle de vie d'un intent

![Cycle de vie d'un intent Cozy](cozy-cycle-vie-intent.svg)

*[Source éditable](cozy-cycle-vie-intent.excalidraw)*

**Étapes détaillées :**

1. Le client appelle `cozy.intents.start('PICK', 'io.cozy.files')`
2. Le stack parcourt les manifests des apps installées, matche action + type
3. Le stack retourne l'URL du service (ou une liste si plusieurs matchent) + les apps non installées qui pourraient gérer l'intent (`availableApps`)
4. Le client ouvre une **iframe** pointant vers l'URL du service (avec `?intent={id}`)
5. Service et client établissent un canal via `window.postMessage` (handshake ready → ack → data)
6. L'utilisateur interagit avec le service (ex. navigue dans ses fichiers, sélectionne)
7. Le service appelle `service.terminate(document)` — envoie un message « completed » avec le résultat
8. Le client ferme l'iframe et exploite le résultat

## Permissions

- Le client peut demander des permissions sur les documents retournés (`GET`, `ALL`)
- Le stack ne résout un intent vers un service que si ce service a déjà les permissions nécessaires sur le doctype
- Les permissions sont scoped aux documents spécifiques retournés

## Ressources Cozy / Twake

| Ressource                                 | URL                                                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| PR du File Picker intent dans Twake Drive | https://github.com/linagora/twake-drive/pull/3787/changes                              |
| Template d'app cliente pour intents       | https://github.com/cozy/cozy-app-template/blob/master/src/components/Views/Intents.jsx |
| Lib de gestion des interactions iframe    | https://github.com/linagora/cozy-libs/tree/master/packages/cozy-interapp               |
| Composants de chargement d'iframe         | https://github.com/linagora/cozy-libs/tree/master/packages/cozy-ui-plus/src/Intent     |
| Documentation intents cozy-stack          | https://docs.cozy.io/en/cozy-stack/intents/                                            |

---

[Suivant : openDesk →](opendesk.md)
