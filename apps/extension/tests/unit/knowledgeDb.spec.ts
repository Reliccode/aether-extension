import { describe, it, expect, beforeAll } from 'vitest';
import { replaceAllRecords, loadAllRecords } from '../../src/content/knowledgeDb';
import { knowledgeSeed } from '../../src/common/knowledgeSeed';

// Provide indexedDB for Node environment
import 'fake-indexeddb/auto';

describe('knowledgeDb', () => {
  beforeAll(async () => {
    await replaceAllRecords([]);
  });

  it('stores and retrieves records', async () => {
    await replaceAllRecords(knowledgeSeed);
    const loaded = await loadAllRecords();
    expect(loaded.length).toBe(knowledgeSeed.length);
    const ids = loaded.map(r => r.recordId).sort();
    const seedIds = knowledgeSeed.map(r => r.recordId).sort();
    expect(ids).toEqual(seedIds);
  });
});
