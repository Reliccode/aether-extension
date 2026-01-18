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

    if (message?.type === 'SCAN_TABS_FOR_NAMES') {
        scanTabsForNames().then(names => {
            sendResponse(names);
        }).catch(() => sendResponse([]));
        return true;
    }

    return false;
});

// Scan all tabs for names
interface ExtractedName {
    name: string;
    source: string;
    confidence: number;
}

async function scanTabsForNames(): Promise<ExtractedName[]> {
    try {
        const tabs = await chrome.tabs.query({});
        const allNames: ExtractedName[] = [];

        for (const tab of tabs) {
            if (!tab.id || !tab.url || tab.url.startsWith('chrome://')) continue;

            try {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: extractNamesFromPage,
                });

                if (results?.[0]?.result) {
                    allNames.push(...results[0].result);
                }
            } catch {
                // Tab may not allow script injection
            }
        }

        // Deduplicate and sort by confidence
        const seen = new Map<string, ExtractedName>();
        for (const item of allNames) {
            const key = item.name.toLowerCase();
            const existing = seen.get(key);
            if (!existing || item.confidence > existing.confidence) {
                seen.set(key, item);
            }
        }

        return Array.from(seen.values())
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 5);
    } catch {
        return [];
    }
}

// Function to be injected into tabs
function extractNamesFromPage(): ExtractedName[] {
    const names: ExtractedName[] = [];
    const hostname = window.location.hostname;

    const isValidName = (str: string): boolean => {
        if (!str || str.length < 2 || str.length > 50) return false;
        if (!/[a-zA-Z]/.test(str)) return false;
        if (/^\+?\d[\d\s-]+$/.test(str)) return false;
        if (/@/.test(str)) return false;
        const blacklist = ['you', 'me', 'admin', 'support', 'team', 'hello', 'hi', 'hey', 'undefined'];
        if (blacklist.includes(str.toLowerCase())) return false;
        return true;
    };

    const getFirstName = (fullName: string): string => fullName.trim().split(/\s+/)[0];

    // WhatsApp
    if (hostname.includes('web.whatsapp.com')) {
        const chatHeader = document.querySelector('[data-testid="conversation-header"] span[title]');
        if (chatHeader) {
            const name = chatHeader.getAttribute('title');
            if (name && isValidName(name)) {
                names.push({ name: getFirstName(name), source: 'WhatsApp', confidence: 1.0 });
            }
        }
    }
    // Gmail
    else if (hostname.includes('mail.google.com')) {
        const emailChips = document.querySelectorAll('[email]');
        emailChips.forEach((chip) => {
            const name = chip.getAttribute('name') || chip.textContent;
            if (name && isValidName(name)) {
                names.push({ name: getFirstName(name), source: 'Gmail', confidence: 0.9 });
            }
        });
    }
    // Conduit
    else if (hostname.includes('conduit')) {
        const headers = document.querySelectorAll('h1, h2, h3, [class*="guest"], [class*="name"], [class*="title"]');
        headers.forEach((el) => {
            const text = el.textContent?.trim();
            if (text && isValidName(text) && text.length < 30) {
                names.push({ name: getFirstName(text), source: 'Conduit', confidence: 0.95 });
            }
        });
    }
    // Generic
    else {
        const title = document.title;
        const titleMatch = title.match(/^([A-Z][a-z]+)/);
        if (titleMatch && isValidName(titleMatch[1])) {
            names.push({ name: titleMatch[1], source: hostname, confidence: 0.5 });
        }
    }

    return names;
}
