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

const FIXED_GLOSSARY_OVERRIDES = {
    'content.fa7fbcfbed2d': { ko: 'MADS', zh: 'MADS', fr: 'MADS', de: 'MADS', es: 'MADS' },
    'content.0eae02262ee9': { ko: 'MADS 설정', zh: 'MADS 設定', fr: 'paramètres MADS', de: 'MADS-Einstellungen', es: 'ajustes de MADS' },
    'content.429b87b28f8f': { ko: 'Sunnypilot', zh: 'Sunnypilot', fr: 'Sunnypilot', de: 'Sunnypilot', es: 'Sunnypilot' },
    'content.9669faff02c5': { ko: 'Sunnypilot 포럼', zh: 'Sunnypilot 論壇', fr: 'Forum Sunnypilot', de: 'Sunnypilot-Forum', es: 'Foro de Sunnypilot' },
    'content.8d3ef1b6afa0': { ko: 'DEC 수준 가속', zh: 'DEC 等級加速', fr: 'accélération de niveau DEC', de: 'Beschleunigung auf DEC-Niveau', es: 'aceleración de nivel DEC' },
    'content.02f1d5771be5': { ko: 'DEC 수준 가속', zh: 'DEC 等級加速', fr: 'accélération de niveau DEC', de: 'Beschleunigung auf DEC-Niveau', es: 'aceleración de nivel DEC' },
    'content.cbe6dd264a2b': { ko: '긍정적 피드백: DEC 수준 가속', zh: '正面回饋：DEC 等級加速', fr: 'retour positif : accélération de niveau DEC', de: 'Positives Feedback: Beschleunigung auf DEC-Niveau', es: 'comentario positivo: aceleración de nivel DEC' },
    'stats.embedTitle': {
        ko: 'Sunnypilot 실시간 통계 대시보드',
        zh: 'Sunnypilot 即時統計儀錶板',
        fr: 'Tableau de bord des statistiques en direct Sunnypilot',
        de: 'Sunnypilot Live-Statistik-Dashboard',
        es: 'Panel de estadísticas en vivo de Sunnypilot',
    },
    'cw.disclaimer.accept': {
        ko: 'sunnypilot이 운전자 보조 시스템이며 안전 운전의 책임이 본인에게 있음을 이해합니다',
        zh: '我瞭解 sunnypilot 是駕駛輔助系統，並願意自行負責行車安全！',
        fr: "Je comprends que sunnypilot est un système d'aide à la conduite et que je suis responsable de la sécurité au volant",
        de: 'Ich verstehe, dass sunnypilot ein Fahrerassistenzsystem ist und ich für sicheres Fahren verantwortlich bin',
        es: 'Entiendo que sunnypilot es un sistema de asistencia al conductor y que soy responsable de conducir de forma segura',
    },
    'cw.step.steering.title': {
        ko: '조향 및 MADS',
        zh: '轉向與 MADS',
        fr: 'Direction et MADS',
        de: 'Lenkung & MADS',
        es: 'Dirección y MADS',
    },
    'cw.export.download': {
        ko: 'sunnypilot-config.json 다운로드',
        zh: '下載設定檔（sunnypilot-config.json）',
        fr: 'Télécharger sunnypilot-config.json',
        de: 'sunnypilot-config.json herunterladen',
        es: 'Descargar sunnypilot-config.json',
    },
    'cw.export.howTo.step1': {
        ko: '위의 sunnypilot-config.json 파일을 다운로드하세요',
        zh: '下載上方的 sunnypilot-config.json 檔案',
        fr: 'Téléchargez le fichier sunnypilot-config.json ci-dessus',
        de: 'Laden Sie die obige Datei sunnypilot-config.json herunter',
        es: 'Descargue el archivo sunnypilot-config.json de arriba',
    },
    'cw.export.howTo.step4': {
        ko: '설정을 적용하려면 sunnypilot 서비스를 재시작하세요',
        zh: '重新啟動 sunnypilot 服務以套用設定',
        fr: 'Redémarrez le service sunnypilot pour appliquer la configuration',
        de: 'Starten Sie den sunnypilot-Dienst neu, um die Konfiguration anzuwenden',
        es: 'Reinicie el servicio sunnypilot para aplicar la configuración',
    },
};

for (const locale of ['ko', 'zh', 'fr', 'de', 'es']) {
    const messagesPath = `locales/${locale}.json`;
    const prevMessagesRaw = readFileSync(messagesPath, 'utf8');
    const messages = JSON.parse(prevMessagesRaw);
    for (const [key, source] of Object.entries(english)) {
        if (FIXED_GLOSSARY_OVERRIDES[key]?.[locale]) {
            messages[key] = FIXED_GLOSSARY_OVERRIDES[key][locale];
            continue;
        }
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
        if (/\bsunnypilot\b/i.test(source)) {
            const sp = { ko: /써니파일럿/g, zh: /陽光領航者|陽光飛行員/g, fr: /pilote ensoleillé/gi, de: /sonniger Pilot/gi, es: /piloto soleado/gi };
            value = value.replace(sp[locale], 'sunnypilot');
        }
        if (/\bopenpilot\b/i.test(source)) {
            const op = { ko: /오픈파일럿/g, zh: /開放領航員|開放飛行員/g, fr: /pilote ouvert/gi, de: /offener Pilot/gi, es: /piloto abierto/gi };
            value = value.replace(op[locale], 'openpilot');
        }
        if (/\bmads\b/i.test(source)) {
            const mads = { ko: /매즈/g, zh: /麥茲|瘋狂(?=設置|設定)/g, fr: /\bfous?\b/gi, de: /\bVerrückte\b/g, es: /\blocos?\b|de locura/gi };
            value = value.replace(mads[locale], locale === 'es' ? 'de MADS' : 'MADS');
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
