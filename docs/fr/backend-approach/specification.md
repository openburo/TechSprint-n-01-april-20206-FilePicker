---
layout: default
title: Specification
parent: Backend approach
nav_order: 2
lang_alt_url: /en/backend-approach/specification/
---

# Specification

[← Backend approach](index.md) · [Accueil](../index.md)

---

## API endpoints

### `GET /files/?deep=1`

List files the user has access to given a particular deepness.

### `GET /files/{id}/`

Get target file (identified _via_ its `id`) metadata.

### `GET /files/{id}/content`

Get target file (identified _via_ its `id`) content.

### `POST /files/{id}/share`

Get target file (identified _via_ its `id`) share link.

## Objects schema

### The `Service` object

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

### The `File` object 

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

### The `ShareLink` object 

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

## Server capabilities 

Openburo-compatible servers explicitly describe their capabilities by providing
a `.well-known` file hosted at their root domain, e.g.:
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
