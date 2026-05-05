---
layout: default
title: Specification
parent: Backend Approach
nav_order: 2
lang_alt_url: /fr/backend-approach/specification/
---

# Specification

[← Backend Approach](index.md) · [Home](../index.md)

---

## API Endpoints

### `GET /files/?deep=1`

List files the user has access to, given a particular depth.

### `GET /files/{id}/`

Get the target file's (identified _via_ its `id`) metadata.

### `GET /files/{id}/content`

Get the target file's (identified _via_ its `id`) content.

### `POST /files/{id}/share`

Get the target file's (identified _via_ its `id`) share link.

## Object Schemas

### The `Service` Object

```json-schema
{
  "$schema": "http://json-schema.org/draft/2020-12/schema",
  "title": "Service",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique identifier for the service"
    },
    "name": {
      "type": "string",
      "description": "Name of the service"
    }
  },
  "required": ["id", "name"],
  "additionalProperties": false
}
```

### The `File` Object

```json-schema
{
  "$schema": "http://json-schema.org/draft/2020-12/schema",
  "title": "File",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique identifier for the file"
    },
    "name": {
      "type": "string",
      "description": "Name of the file"
    },
    "type": {
      "type": "string",
      "enum": ["file", "directory"],
      "description": "Type of the file (file or directory)"
    },
    "mime_type": {
      "type": "string",
      "description": "MIME type of the file"
    },
    "path": {
      "type": "string",
      "description": "Path to the file"
    },
    "last_modified": {
      "type": "string",
      "format": "date-time",
      "description": "Last modified date of the file"
    },
    "creation_date": {
      "type": "string",
      "format": "date-time",
      "description": "Creation date of the file"
    },
    "owner": {
      "type": "string",
      "description": "Owner of the file"
    },
    "size": {
      "type": "integer",
      "description": "Size of the file in bytes"
    }
  },
  "required": [
    "id",
    "name",
    "type",
    "mime_type",
    "path",
    "last_modified",
    "creation_date",
    "owner",
    "size"
  ],
  "additionalProperties": false
}
```

### The `ShareLink` Object

```json-schema
{
  "$schema": "http://json-schema.org/draft/2020-12/schema",
  "title": "ShareLink",
  "type": "object",
  "properties": {
    "url": {
      "type": "string",
      "format": "uri",
      "description": "URL of the share link"
    }
  },
  "required": ["url"],
  "additionalProperties": false
}
```

## Server Capabilities

Openburo-compatible servers explicitly describe their capabilities by providing a `.well-known` file hosted at their root domain, for example:
`https://drive.com/.well-known/openburo/config.json`

```json
{
  "version": "0.1.0",
  "service": {
    "id": "mydrive",
    "name": "my-drive",
    "capabilities": [
      "PICK"
    ],
    "endpoints": {
      "drive": "/drive/my"
    }
  }
}
```
