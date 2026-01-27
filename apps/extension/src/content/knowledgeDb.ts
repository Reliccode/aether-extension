import { openDB, type IDBPDatabase } from 'idb';
import type { KnowledgeRecord } from '@aether/contracts';

const DB_NAME = 'aether-knowledge';
const STORE = 'records';

async function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'recordId' });
      }
    },
  });
}

export async function loadAllRecords(): Promise<KnowledgeRecord[]> {
  const db = await getDb();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  const all = await store.getAll();
  await tx.done;
  return (all as KnowledgeRecord[]) || [];
}

export async function replaceAllRecords(records: KnowledgeRecord[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  await store.clear();
  for (const rec of records) {
    await store.put(rec);
  }
  await tx.done;
}
