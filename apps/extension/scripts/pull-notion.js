import 'fake-indexeddb/auto';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { replaceAllRecords } from '../src/content/knowledgeDb.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SAMPLE = resolve(__dirname, 'notion-sample.json');

const mappingConfig = {
  keyProperties: ['Address', 'Alias'],
  mappings: [
    { notionProperty: 'Keybox Code', fieldKey: 'keybox_code', type: 'secret' },
    { notionProperty: 'WiFi Name', fieldKey: 'wifi_name', type: 'text' },
    { notionProperty: 'WiFi Password', fieldKey: 'wifi_password', type: 'secret' },
    { notionProperty: 'Parking', fieldKey: 'parking', type: 'text' },
  ],
};

function readTextProperty(prop) {
  if (!prop) return '';
  if (Array.isArray(prop.title)) return prop.title.map(p => p.plain_text || '').join(' ').trim();
  if (Array.isArray(prop.rich_text)) return prop.rich_text.map(p => p.plain_text || '').join(' ').trim();
  if (typeof prop === 'string') return prop;
  return '';
}

function mapRecord(page) {
  const name = readTextProperty(page.properties?.Name) || page.properties?.Address?.rich_text?.[0]?.plain_text || 'Untitled';
  const keys = mappingConfig.keyProperties
    .map(prop => readTextProperty(page.properties?.[prop]))
    .filter(Boolean)
    .map(k => k.toLowerCase());

  const fields = {};
  for (const map of mappingConfig.mappings) {
    const raw = readTextProperty(page.properties?.[map.notionProperty]);
    if (!raw) continue;
    if (map.type === 'link') {
      fields[map.fieldKey] = { type: 'link', value: { label: raw, url: raw } };
    } else if (map.type === 'secret') {
      fields[map.fieldKey] = { type: 'secret', value: raw, revealPolicy: 'mask', auditOnReveal: true };
    } else {
      fields[map.fieldKey] = { type: 'text', value: raw };
    }
  }

  return {
    recordId: page.id || crypto.randomUUID(),
    entityType: 'apartment',
    title: name,
    keys: keys.length ? keys : [name.toLowerCase()],
    fields,
    updatedAt: page.last_edited_time || new Date().toISOString(),
    sourceRef: { kind: 'notion', url: page.url || '', lastEdited: page.last_edited_time },
  };
}

async function main() {
  const samplePath = process.env.NOTION_SAMPLE || DEFAULT_SAMPLE;
  const raw = await readFile(samplePath, 'utf8');
  const parsed = JSON.parse(raw);
  const pages = parsed.results || [];
  const records = pages.map(mapRecord);
  await replaceAllRecords(records);
  console.log(`Synced ${records.length} records from ${samplePath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
