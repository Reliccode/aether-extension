import { loadAuditLatest, recordAuditEvent } from './knowledgeDb';

const cache: Record<string, string> = {};
let hydrated = false;

export async function getLastReveal(recordId: string, fieldKey: string): Promise<string | undefined> {
  if (!hydrated) {
    Object.assign(cache, await loadAuditLatest());
    hydrated = true;
  }
  return cache[`${recordId}:${fieldKey}`];
}

export async function logReveal(recordId: string, fieldKey: string) {
  const timestamp = new Date().toISOString();
  const id = `${recordId}:${fieldKey}:${timestamp}`;
  await recordAuditEvent({ id, recordId, fieldKey, timestamp, action: 'reveal' });
  cache[`${recordId}:${fieldKey}`] = timestamp;
}
