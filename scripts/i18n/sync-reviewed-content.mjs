import { readFileSync, writeFileSync } from 'node:fs';

const read = file => JSON.parse(readFileSync(file, 'utf8'));
const english = read('locales/en.json');
const sourceKeys = new Map(Object.entries(english).map(([key, value]) => [value, key]));
const canonicalFields = new Set(['id', 'key', 'type', 'make', 'model', 'date', 'version', 'lastUpdated', 'schemaVersion', 'deviceAvailability', 'forumUrl', 'docUrl', 'device', 'harness', 'radar', 'drivingModel', 'torqueTuning', 'lateralControl', 'longitudinalControl', 'mads', 'experimentalMode', 'badge', 'category', 'unit', 'years', 'user', 'icon', 'options', 'default', 'recommended', 'settingsKeys', 'tags', 'testedOn', 'includes', 'steeringFeel', 'manifestUrl', 'modelRef', 'shortName', 'minimumSelectorVersion']);
const deviceText = new Set();
function collect(value) {
    if (typeof value === 'string') deviceText.add(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
}
collect(read('data/toggles.json'));

// "Offroad" is openpilot's parked/device state, not driving on unpaved roads.
function correctOffroad(source, value, locale) {
    if (!/offroad/i.test(source) || !(deviceText.has(source) || /device|parked|update|shutdown|download/i.test(source))) return value;
    const corrections = {
        ko: [[/오프로드/g, '정차 모드']],
        zh: [[/越野型/g, '停車狀態'], [/越野/g, '停車模式']],
        fr: [[/hors[- ]route/gi, 'en mode stationné'], [/tout[- ]terrain/gi, 'stationné']],
        de: [[/Offroad-Modus/gi, 'Standmodus'], [/Offroad/g, 'Standmodus'], [/im Gelände/gi, 'im Stand']],
        es: [[/modo todoterreno/gi, 'modo estacionado'], [/todoterreno/gi, 'estacionado'], [/fuera de (?:la )?carretera/gi, 'en modo estacionado']],
    };
    for (const [pattern, replacement] of corrections[locale]) value = value.replace(pattern, replacement);
    return value;
}

for (const locale of ['ko', 'zh', 'fr', 'de', 'es']) {
    const messagesPath = `locales/${locale}.json`;
    const prevMessagesRaw = readFileSync(messagesPath, 'utf8');
    const messages = JSON.parse(prevMessagesRaw);
    for (const [key, source] of Object.entries(english)) {
        let value = correctOffroad(source, messages[key], locale);
        // comma is the device maker; forks are software derivatives.
        if (/\bcomma\b/i.test(source)) {
            const brand = { ko: /쉼표/g, zh: /逗[号號]/g, fr: /virgule/gi, de: /Komma/g, es: /\bcoma\b/gi };
            value = value.replace(brand[locale], 'comma');
        }
        if (/\bchestnut\b/i.test(source)) {
            const hardware = { ko: /밤나무|밤색/g, zh: /板栗|栗子/g, fr: /marron|châtaigne/gi, de: /Kastanien?/g, es: /castañ[ao]s?/gi };
            value = value.replace(hardware[locale], 'Chestnut');
        }
        if (source.includes('commaai/openpilot')) value = value.replace(/(?:comma|virgule)\/openpilot/g, 'commaai/openpilot');
        if (/\bforks?\b/i.test(source)) {
            const software = { ko: [/포크/g, '포크'], zh: [/叉子/g, '分支'], fr: [/fourchettes?|fourches?/gi, 'forks'], de: [/Gabeln?/g, 'Forks'], es: [/tenedores?/gi, 'derivados'] };
            value = value.replace(...software[locale]);
        }
        if (/global firehose/i.test(source)) {
            if (locale === 'ko') value = value.replace(/글로벌 소방 호스/g, '전 세계 데이터 스트림');
            if (locale === 'zh') value = value.replace(/全球消防水[帶带]/g, '全球資料流');
        }
        if (/community/i.test(source)) {
            if (locale === 'ko') value = value.replace(/지역사회/g, '커뮤니티');
            if (locale === 'zh') value = value.replace(/社[区區]/g, '社群');
        }
        messages[key] = value;
    }
    const nextMessagesRaw = JSON.stringify(messages, null, 2) + '\n';
    if (nextMessagesRaw !== prevMessagesRaw) writeFileSync(messagesPath, nextMessagesRaw);

    for (const kind of ['cars', 'features', 'models', 'toggles']) {
        const source = read(`data/${kind}.json`);
        const targetPath = `data/${kind}.${locale}.json`;
        const prevTargetRaw = readFileSync(targetPath, 'utf8');
        const target = JSON.parse(prevTargetRaw);
        function sync(from, to) {
            if (Array.isArray(from) && Array.isArray(to)) {
                to.length = from.length;
            }
            for (const [key, value] of Object.entries(from)) {
                if (canonicalFields.has(key) || (key === 'name' && 'date' in from)) {
                    to[key] = structuredClone(value);
                    continue;
                }
                if (typeof value === 'string') {
                    const lookup = sourceKeys.get(value);
                    // Canonical enum values and identifiers stay serialized unchanged.
                    if (lookup && !canonicalFields.has(key) && !(key === 'name' && 'date' in from)) to[key] = messages[lookup];
                    else if (to[key] === undefined) to[key] = value;
                } else if (value && typeof value === 'object') {
                    if (!to[key] || typeof to[key] !== 'object' || Array.isArray(value) !== Array.isArray(to[key])) {
                        to[key] = Array.isArray(value) ? [] : {};
                    }
                    sync(value, to[key]);
                } else {
                    to[key] = value;
                }
            }
        }
        sync(source, target);
        const nextTargetRaw = JSON.stringify(target, null, 2) + '\n';
        if (nextTargetRaw !== prevTargetRaw) writeFileSync(targetPath, nextTargetRaw);
    }
}
console.log('Synchronized reviewed data translations and parked-state terminology.');
