'use client';

import { useTextTranslation } from '@/lib/i18n';

/** Also works in server-rendered page shells: the text updates with context. */
export default function TranslatedText({ text }: { text?: string | null }) {
    const translate = useTextTranslation();
    return text == null ? null : translate(text);
}
