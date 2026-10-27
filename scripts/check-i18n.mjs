#!/usr/bin/env node
/** Check UI key/placeholder parity and the complete localized data topology. */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const read = file => JSON.parse(readFileSync(file, 'utf8'));
const english = read('locales/en.json');
const englishKeys = Object.keys(english);
const sourceValues = new Set(Object.values(english));
const properNames = new Set(['Sunnylink', 'Sunnylink Wiki', 'Comma 3 / 3X', 'Comma 4', 'sunnypilot', 'openpilot', 'comma.ai', 'GitHub', 'modelV2', 'rlog', 'qlog', 'JSON', 'SVG', 'WebGL 2', 'Esc', 'Hz', 'RMS', 'cm', 'km', 'mph', 'km/h', 'm/s²', 'm/s³']);
for (const category of read('data/models.json').categories) for (const model of category.models) properNames.add(model.name);
for (const car of read('data/cars.json').vehicles) { properNames.add(car.make); properNames.add(car.model); }
const locales = ['ko', 'zh', 'fr', 'de', 'es'];
const errors = [];
const fail = message => errors.push(message);
const placeholders = value => [...value.matchAll(/\{\{([^}]+)\}\}/g)].map(match => match[1]).sort().join(',');

for (const locale of locales) {
    const messages = read(`locales/${locale}.json`);
    for (const key of englishKeys) {
        const value = messages[key];
        if (typeof value !== 'string' || !value.trim()) fail(`${locale}: missing/empty ${key}`);
        else if (placeholders(value) !== placeholders(english[key])) fail(`${locale}: interpolation mismatch ${key}`);
        if (typeof value === 'string' && /ZXQ\d+QXZ|\uFFFD/.test(value)) fail(`${locale}: damaged translation ${key}`);
    }
    for (const key of Object.keys(messages)) if (!(key in english)) fail(`${locale}: unexpected ${key}`);
    console.log(`${locale}: ${Object.keys(messages).length} UI keys checked`);

    for (const kind of ['cars', 'features', 'models', 'toggles']) {
        const source = read(`data/${kind}.json`);
        const target = read(`data/${kind}.${locale}.json`);
        const canonical = new Set(['id', 'key', 'type', 'make', 'model', 'date', 'version', 'lastUpdated', 'schemaVersion', 'deviceAvailability', 'forumUrl', 'docUrl', 'device', 'harness', 'drivingModel', 'torqueTuning', 'lateralControl', 'longitudinalControl', 'mads', 'experimentalMode', 'badge', 'category', 'unit', 'years', 'user', 'icon', 'options', 'default', 'recommended', 'settingsKeys', 'tags', 'testedOn', 'includes', 'steeringFeel']);
        function walk(from, to, location, field = '') {
            if (Array.isArray(from)) {
                if (!Array.isArray(to) || from.length !== to.length) { fail(`${locale} ${location}: array topology differs`); return; }
                from.forEach((value, index) => walk(value, to[index], `${location}[${index}]`, field));
            } else if (from && typeof from === 'object') {
                if (!to || typeof to !== 'object') { fail(`${locale} ${location}: missing object`); return; }
                const fromKeys = Object.keys(from).sort().join(',');
                if (fromKeys !== Object.keys(to).sort().join(',')) fail(`${locale} ${location}: object fields differ`);
                for (const [key, value] of Object.entries(from)) walk(value, to[key], `${location}.${key}`, key);
            } else if (typeof from === 'string') {
                if (typeof to !== 'string' || (from.trim() && !to.trim())) fail(`${locale} ${location}: missing text`);
                if (canonical.has(field) && to !== from) fail(`${locale} ${location}: changed canonical value`);
                if (field === 'name' && location.includes('.models[') && to !== from) fail(`${locale} ${location}: changed model identity`);
                if (!canonical.has(field) && !['name', 'dataSource', 'radar'].includes(field) && /[A-Za-z]/.test(from) && from.split(/\s+/).length > 3 && from === to) fail(`${locale} ${location}: untranslated prose`);
            } else if (to !== from) fail(`${locale} ${location}: changed numeric/boolean value`);
        }
        walk(source, target, kind);
    }
}

function checkSources(dir) {
    for (const name of readdirSync(dir)) {
        const file = path.join(dir, name);
        if (name.includes(' (1)')) continue;
        if (!path.extname(name)) { checkSources(file); continue; }
        if (!/\.tsx?$/.test(name)) continue;
        const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
        function visit(node) {
            if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't' && node.arguments.length && ts.isStringLiteral(node.arguments[0])) {
                const key = node.arguments[0].text;
                if (!(key in english)) fail(`${file}: undefined UI key ${key}`);
            }
            function checkDisplay(expression) {
                let value;
                if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) value = expression.text;
                else if (ts.isTemplateExpression(expression)) {
                    value = expression.head.text;
                    expression.templateSpans.forEach((span, index) => { value += `{{value${index}}}` + span.literal.text; });
                } else if (ts.isConditionalExpression(expression)) {
                    checkDisplay(expression.whenTrue); checkDisplay(expression.whenFalse);
                }
                if (value && /[A-Za-z]{2}/.test(value.replace(/\{\{[^}]+\}\}/g, '')) && !properNames.has(value) && !sourceValues.has(value)) fail(`${file}: display text has no translation: ${value}`);
            }
            if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'tx' && node.arguments[0]) checkDisplay(node.arguments[0]);
            if (ts.isJsxAttribute(node) && node.name.getText(source) === 'text' && node.initializer) {
                if (ts.isStringLiteral(node.initializer)) checkDisplay(node.initializer);
                else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) checkDisplay(node.initializer.expression);
            }
            if (ts.isJsxText(node)) {
                const value = node.text.replace(/\s+/g, ' ').trim();
                if (/[A-Za-z]{2}/.test(value) && !properNames.has(value)) fail(`${file}: raw untranslated JSX text: ${value}`);
            }
            ts.forEachChild(node, visit);
        }
        visit(source);
    }
}
checkSources('app');
checkSources('components');
if (errors.length) {
    for (const error of errors) console.error(error);
    console.error(`${errors.length} localization errors.`);
    process.exit(1);
}
console.log('UI placeholders, translation calls, data structures, and canonical values match in every locale.');
