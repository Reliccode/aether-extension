import { replaceAllRecords } from '../src/content/knowledgeDb.js';
import { knowledgeSeed } from '../src/common/knowledgeSeed.js';

async function main() {
  const records = knowledgeSeed;
  await replaceAllRecords(records);
  console.log(`Loaded ${records.length} knowledge records into IndexedDB.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
