import json
import os

DATA_DIR = './data'
BASE_FILE = 'models.json'
LOCALES = ['de', 'es', 'fr', 'ko', 'zh']

def sync_files():
    base_path = os.path.join(DATA_DIR, BASE_FILE)
    with open(base_path, 'r', encoding='utf-8') as f:
        base_content = json.load(f)

    for locale in LOCALES:
        locale_file = f'models.{locale}.json'
        locale_path = os.path.join(DATA_DIR, locale_file)
        
        if not os.path.exists(locale_path):
            print(f"Creating missing file: {locale_file}")
            with open(locale_path, 'w', encoding='utf-8') as f:
                json.dump(base_content, f, indent=2, ensure_ascii=False)
            continue

        with open(locale_path, 'r', encoding='utf-8') as f:
            locale_content = json.load(f)

        # Update top-level metadata
        locale_content['totalModels'] = base_content['totalModels']
        locale_content['lastUpdated'] = base_content['lastUpdated']
        locale_content['version'] = base_content.get('version', locale_content.get('version'))

        # Sync vibeGuide
        if 'vibeGuide' in base_content:
            if 'vibeGuide' not in locale_content:
                locale_content['vibeGuide'] = {}
            for key, vibe in base_content['vibeGuide'].items():
                if key not in locale_content['vibeGuide']:
                    locale_content['vibeGuide'][key] = vibe.copy()
                else:
                    locale_content['vibeGuide'][key]['includes'] = vibe['includes']

        # Sync categories and models
        synced_categories = []
        for base_cat in base_content['categories']:
            existing_cat = next((c for c in locale_content['categories'] if c['id'] == base_cat['id']), None)
            
            if not existing_cat:
                synced_categories.append(base_cat)
                continue

            # Sync models within category
            synced_models = []
            for base_model in base_cat['models']:
                existing_model = next((m for m in existing_cat['models'] if m['name'] == base_model['name']), None)
                
                if not existing_model:
                    synced_models.append(base_model)
                    continue

                # Merge structural fields but keep translations.
                # Hard data carries no prose, so it always tracks the base file.
                data_fields = [
                    'badge', 'tags', 'communityScore', 'totalVotes',
                    'sentiment', 'testedOn', 'forumUrl'
                ]
                # These read as prose once localized (dates are written in the
                # locale's own format), so only fill them in when the locale has
                # nothing yet -- overwriting would clobber existing translations.
                localized_fields = [
                    'date', 'bestFor', 'steeringFeel', 'positives', 'negatives'
                ]

                updated_model = existing_model.copy()
                for field in data_fields:
                    if field in base_model:
                        updated_model[field] = base_model[field]
                # An absent value or an empty list carries no translation, so it
                # is safe to seed from the base file.
                def is_unset(v):
                    return v is None or (isinstance(v, list) and len(v) == 0)
                for field in localized_fields:
                    if field in base_model and (field not in updated_model
                                                or is_unset(updated_model[field])):
                        updated_model[field] = base_model[field]

                synced_models.append(updated_model)

            new_cat = existing_cat.copy()
            new_cat['description'] = existing_cat.get('description', base_cat['description'])
            new_cat['models'] = synced_models
            synced_categories.append(new_cat)

        locale_content['categories'] = synced_categories

        with open(locale_path, 'w', encoding='utf-8') as f:
            json.dump(locale_content, f, indent=2, ensure_ascii=False)
            f.write('\n')
        print(f"✓ Synchronized {locale_file}")

if __name__ == "__main__":
    sync_files()
