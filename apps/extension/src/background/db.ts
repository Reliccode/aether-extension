import { openDB } from 'idb';
import type { DBSchema } from 'idb';
import type { Snippet } from '@aether/contracts';

interface AetherDB extends DBSchema {
    snippets: {
        key: string;
        value: Snippet;
        indexes: { 'by-trigger': string };
    };
}

const DB_NAME = 'aether-db';
const DB_VERSION = 2;

let dbInstance: Awaited<ReturnType<typeof openDB<AetherDB>>> | null = null;

export async function initDB() {
    if (dbInstance) return dbInstance;

    const db = await openDB<AetherDB>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion) {
            if (oldVersion < 1) {
                const store = db.createObjectStore('snippets', { keyPath: 'id' });
                store.createIndex('by-trigger', 'tags', { multiEntry: true });
            }
        },
    });

    dbInstance = db;
    return db;
}

export async function getAllSnippets(): Promise<Snippet[]> {
    const db = await initDB();
    const snippets = await db.getAll('snippets');
    // Ensure translations field exists for backward compatibility
    return snippets.map(s => ({
        ...s,
        translations: s.translations || {}
    }));
}

export async function saveSnippet(snippet: Omit<Snippet, 'id' | 'usageCount' | 'lastUsed'>): Promise<Snippet> {
    const db = await initDB();
    const newSnippet: Snippet = {
        ...snippet,
        translations: snippet.translations || {},
        id: crypto.randomUUID(),
        usageCount: 0,
        lastUsed: Date.now(),
    };
    await db.add('snippets', newSnippet);
    return newSnippet;
}

export async function updateSnippetUsage(id: string): Promise<void> {
    const db = await initDB();
    const snippet = await db.get('snippets', id);
    if (snippet) {
        snippet.usageCount++;
        snippet.lastUsed = Date.now();
        await db.put('snippets', snippet);
    }
}

export async function updateSnippet(data: {
    id: string;
    title: string;
    content: string;
    tags: string[];
    translations?: { de?: string };
}): Promise<Snippet | null> {
    const db = await initDB();
    const existing = await db.get('snippets', data.id);
    if (!existing) return null;

    const updated: Snippet = {
        ...existing,
        title: data.title,
        content: data.content,
        tags: data.tags,
        translations: data.translations || existing.translations || {},
    };
    await db.put('snippets', updated);
    return updated;
}

export async function deleteSnippet(id: string): Promise<boolean> {
    const db = await initDB();
    const existing = await db.get('snippets', id);
    if (!existing) return false;

    await db.delete('snippets', id);
    return true;
}
