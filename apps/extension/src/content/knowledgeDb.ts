import { openDB, type IDBPDatabase } from 'idb';
import type { KnowledgeRecord } from '@aether/contracts';

export const DB_NAME = 'aether-knowledge';
const STORE = 'records';
const AUDIT_STORE = 'audit';

async function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 2, {
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'recordId' });
      }
      if (oldVersion < 2 && !db.objectStoreNames.contains(AUDIT_STORE)) {
        db.createObjectStore(AUDIT_STORE, { keyPath: 'id' });
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

export interface AuditEvent {
  id: string;
  recordId: string;
  fieldKey: string;
  timestamp: string;
  action: 'reveal';
}

export async function recordAuditEvent(event: AuditEvent): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(AUDIT_STORE, 'readwrite');
  await tx.store.put(event);
  await tx.done;
}

export async function loadAuditLatest(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db.objectStoreNames.contains(AUDIT_STORE)) return {};
  const tx = db.transaction(AUDIT_STORE, 'readonly');
  const all = await tx.store.getAll();
  await tx.done;
  const latest: Record<string, string> = {};
  for (const ev of all as AuditEvent[]) {
    const key = `${ev.recordId}:${ev.fieldKey}`;
    if (!latest[key] || latest[key] < ev.timestamp) {
      latest[key] = ev.timestamp;
    }
  }
  return latest;
}
