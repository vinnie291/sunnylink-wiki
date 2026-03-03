---
description: Safely updating shared JSON data models across languages
---

This workflow ensures data consistency when modifying shared content like model definitions, features, or toggles.

1. **Locate base data files**
   The primary source of truth is the English `.json` files in the `data/` directory (e.g., `data/models.json`, `data/features.json`, `data/toggles.json`).

2. **Modify the base data**
   Edit the base `.json` file. Ensure JSON syntax is valid. Update properties like `name`, `description`, etc.

3. **Synchronize localized data files**
   When top-level items are added, removed, or structure changes, you MUST replicate the structural change to all translated variations:
   - `data/models.de.json`, `data/models.es.json`, `data/models.fr.json`, `data/models.ko.json`, `data/models.zh.json`
   - Maintain the same ID mapping, but translate the textual description and name values.
