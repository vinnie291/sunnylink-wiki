import english from '../locales/en.json';

export type TranslationParams = Record<string, string | number>;
export function interpolate(value: string, params: TranslationParams = {}): string {
    return value.replace(/\{\{([^}]+)\}\}/g, (token, name: string) =>
        Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : token);
}

const sourceKeys = new Map(Object.entries(english).map(([key, value]) => [value, key]));
const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const templates = Object.entries(english).filter(([, value]) => /\{\{value\d+\}\}/.test(value) && /[A-Za-z]{2}/.test(value.replace(/\{\{[^}]+\}\}/g, '')))
    .map(([key, source]) => {
        const names: string[] = [];
        let offset = 0;
        let pattern = '^';
        for (const match of source.matchAll(/\{\{(value\d+)\}\}/g)) {
            pattern += escapePattern(source.slice(offset, match.index)) + '(.*?)';
            names.push(match[1]);
            offset = match.index! + match[0].length;
        }
        pattern += escapePattern(source.slice(offset)) + '$';
        return { key, source, names, pattern: new RegExp(pattern, 's') };
    }).sort((a, b) => b.source.replace(/\{\{[^}]+\}\}/g, '').length - a.source.replace(/\{\{[^}]+\}\}/g, '').length);

/** Translate presentation text while keeping data IDs and serialized values intact. */
const resultCache = new WeakMap<Record<string, string>, Map<string, string>>();

export function translateText(text: string, messages: Record<string, string>, locale = 'en'): string {
    if (locale === 'en') return text;
    if (/^(?:[A-Z][a-z]+ \d{1,2}, \d{4}|\d{4}-\d{2}-\d{2})$/.test(text)) {
        const date = new Date(text);
        if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
    }
    if (!/[A-Za-z]/.test(text)) return text;
    let cache = resultCache.get(messages);
    if (!cache) { cache = new Map(); resultCache.set(messages, cache); }
    const cached = cache.get(text);
    if (cached !== undefined) return cached;
    const key = sourceKeys.get(text);
    if (key) return messages[key] ?? text;
    for (const template of templates) {
        const match = text.match(template.pattern);
        if (!match) continue;
        const params = Object.fromEntries(template.names.map((name, index) => [name, translateText(match[index + 1], messages, locale)]));
        return interpolate(messages[template.key] ?? template.source, params);
    }
    // Evidence tooltips combine translated labels and source quotes at runtime.
    // Translate each complete line/list item rather than treating the combined
    // text as a new message; preserve bullets, punctuation, and line breaks.
    if (text.includes('\n')) return text.split('\n').map(line => translateText(line, messages, locale)).join('\n');
    const bullet = text.match(/^([+−–•] )(.+)$/s);
    if (bullet) return bullet[1] + translateText(bullet[2], messages, locale);
    if (text.includes(', ') && text.split(', ').every(part => sourceKeys.has(part))) {
        return text.split(', ').map(part => translateText(part, messages, locale)).join(', ');
    }
    if (cache.size < 5000) cache.set(text, text);
    return text;
}
