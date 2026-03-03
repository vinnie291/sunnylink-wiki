---
description: Add a new UI string and its translations
---

This workflow ensures all static text in the UI is fully translated across the 6 supported languages (`en`, `es`, `fr`, `de`, `ko`, `zh`).

1. **Add to base locale (`en.json`)**
   Open `locales/en.json` and add the new key-value string pair. Maintain alphabetical sorting if possible, or group by component.

2. **Translate to other locales**
   For each remaining language file (`locales/es.json`, `locales/fr.json`, `locales/de.json`, `locales/ko.json`, `locales/zh.json`), add the exact same key. Provide the translated value.

3. **Implement in UI**
   In the relevant `.tsx` component, import the translation hook.
   ```tsx
   import { useTranslation } from '@/lib/i18n';
   
   // ... inside component ...
   const { t } = useTranslation();
   
   // ...
   <div>{t('your_new_key')}</div>
   ```
