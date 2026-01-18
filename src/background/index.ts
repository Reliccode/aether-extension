/// <reference types="chrome"/>
import Fuse from 'fuse.js';
import { initDB, getAllSnippets, saveSnippet, updateSnippet, deleteSnippet, updateSnippetUsage } from './db';
import type { SearchResult, Snippet } from '../common/types';

// Initialize DB on install
chrome.runtime.onInstalled.addListener(() => {
    initDB().catch((err: Error) => console.error('DB init error:', err));
});

// Also init on startup
chrome.runtime.onStartup.addListener(() => {
    initDB().catch((err: Error) => console.error('DB init error:', err));
});

// Initialize immediately when script loads
initDB().catch((err: Error) => console.error('DB init error:', err));

// Search Logic
let searchIndex: Fuse<Snippet> | null = null;
let cachedSnippets: Snippet[] = [];

async function refreshSearchIndex(): Promise<Snippet[]> {
    try {
        cachedSnippets = await getAllSnippets();
        searchIndex = new Fuse(cachedSnippets, {
            keys: [
                { name: 'title', weight: 0.4 },
                { name: 'tags', weight: 0.4 },
                { name: 'content', weight: 0.2 }
            ],
            threshold: 0.4,
            includeScore: true,
        });
        return cachedSnippets;
    } catch (err) {
        console.error('Search index error:', err);
        return [];
    }
}

async function performSearch(query: string): Promise<SearchResult[]> {
    try {
        if (!searchIndex || cachedSnippets.length === 0) {
            await refreshSearchIndex();
        }

        // Empty query = return recent snippets
        if (!query || query.trim() === '') {
            const sorted = [...cachedSnippets].sort((a, b) => b.lastUsed - a.lastUsed);
            return sorted.slice(0, 5);
        }

        // Fuzzy search
        const results = searchIndex!.search(query);
        return results.map(result => ({
            ...result.item,
            score: result.score
        })).slice(0, 5);
    } catch (err) {
        console.error('Search error:', err);
        return [];
    }
}

// Message Listener
chrome.runtime.onMessage.addListener((
    message: { type: string; payload?: Record<string, unknown> },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
) => {
    if (message?.type === 'SEARCH_QUERY') {
        const query = (message.payload?.query as string) || '';
        performSearch(query).then(sendResponse).catch(() => sendResponse([]));
        return true;
    }

    if (message?.type === 'GET_ALL_SNIPPETS') {
        getAllSnippets().then(sendResponse).catch(() => sendResponse([]));
        return true;
    }

    if (message?.type === 'SAVE_SNIPPET') {
        const payload = message.payload as Omit<Snippet, 'id' | 'usageCount' | 'lastUsed'>;
        saveSnippet(payload).then(snippet => {
            refreshSearchIndex();
            sendResponse(snippet);
        }).catch(() => sendResponse(null));
        return true;
    }

    if (message?.type === 'UPDATE_SNIPPET') {
        const payload = message.payload as { id: string; title: string; content: string; tags: string[]; translations?: { de?: string } };
        updateSnippet(payload).then(updated => {
            refreshSearchIndex();
            sendResponse(updated);
        }).catch(() => sendResponse(null));
        return true;
    }

    if (message?.type === 'DELETE_SNIPPET') {
        const payload = message.payload as { id: string };
        deleteSnippet(payload.id).then(success => {
            refreshSearchIndex();
            sendResponse(success);
        }).catch(() => sendResponse(false));
        return true;
    }

    if (message?.type === 'OPEN_OPTIONS') {
        chrome.runtime.openOptionsPage();
        sendResponse(true);
        return true;
    }

    if (message?.type === 'UPDATE_USAGE') {
        const payload = message.payload as { id: string };
        updateSnippetUsage(payload.id).then(() => {
            refreshSearchIndex();
            sendResponse(true);
        }).catch(() => sendResponse(false));
        return true;
    }

    return false;
});
