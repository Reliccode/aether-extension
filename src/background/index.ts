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

    // Better name validation - must look like a real name
    const isValidName = (str: string): boolean => {
        if (!str || str.length < 2 || str.length > 40) return false;

        // Must start with capital letter and contain only letters/spaces
        if (!/^[A-Z][a-zA-Z\s'-]+$/.test(str)) return false;

        // Should not be a single word less than 3 chars
        if (str.length < 3 && !str.includes(' ')) return false;

        // Blacklist common non-name words
        const blacklist = [
            'you', 'me', 'admin', 'support', 'team', 'hello', 'hi', 'hey',
            'undefined', 'null', 'inbox', 'sent', 'draft', 'all', 'new',
            'message', 'messages', 'chat', 'user', 'guest', 'home', 'settings',
            'notification', 'notifications', 'search', 'menu', 'profile',
            'google', 'gmail', 'youtube', 'whatsapp', 'conduit', 'internet',
            'ncba', 'astropay', 'infomail', 'todofollow'
        ];
        if (blacklist.includes(str.toLowerCase())) return false;

        return true;
    };

    const getFirstName = (fullName: string): string => {
        const parts = fullName.trim().split(/\s+/);
        return parts[0];
    };

    // WhatsApp - Get current chat contact name
    if (hostname.includes('web.whatsapp.com')) {
        // Primary: Current conversation header
        const chatHeader = document.querySelector('[data-testid="conversation-header"] span[title]');
        if (chatHeader) {
            const name = chatHeader.getAttribute('title');
            if (name && isValidName(name)) {
                names.push({ name: getFirstName(name), source: 'WhatsApp', confidence: 1.0 });
            }
        }

        // Fallback: Try alternate selector
        const headerSpan = document.querySelector('header span[dir="auto"]');
        if (headerSpan && names.length === 0) {
            const name = headerSpan.textContent?.trim();
            if (name && isValidName(name)) {
                names.push({ name: getFirstName(name), source: 'WhatsApp', confidence: 0.9 });
            }
        }
    }

    // Gmail - Get recipients from compose or email thread
    else if (hostname.includes('mail.google.com')) {
        // Compose recipients
        const recipients = document.querySelectorAll('[data-hovercard-id] span[email]');
        recipients.forEach((el) => {
            const name = el.textContent?.trim();
            if (name && isValidName(name)) {
                names.push({ name: getFirstName(name), source: 'Gmail', confidence: 0.95 });
            }
        });

        // Email sender in thread
        const senders = document.querySelectorAll('[data-message-id] [email]');
        senders.forEach((el) => {
            const name = el.getAttribute('name');
            if (name && isValidName(name)) {
                names.push({ name: getFirstName(name), source: 'Gmail', confidence: 0.85 });
            }
        });
    }

    // Conduit - Get guest name from conversation
    else if (hostname.includes('conduit')) {
        // SPECIFIC SELECTOR: Guest name in conversation header
        // The selector from user's inspect: p.truncate.text-title-lg
        const guestName = document.querySelector('p.text-title-lg, p.truncate.text-title-lg');
        if (guestName) {
            const name = guestName.textContent?.trim();
            if (name && isValidName(name)) {
                names.push({ name: getFirstName(name), source: 'Conduit', confidence: 1.0 });
            }
        }

        // Fallback: Look for profile picture alt text
        const profileImg = document.querySelector('img[alt*="profile"]');
        if (profileImg && names.length === 0) {
            const alt = profileImg.getAttribute('alt');
            const match = alt?.match(/profile[:\s]+(.+)/i);
            if (match && isValidName(match[1])) {
                names.push({ name: getFirstName(match[1]), source: 'Conduit', confidence: 0.8 });
            }
        }
    }

    // YouTube - Get video creator name
    else if (hostname.includes('youtube.com')) {
        const channelName = document.querySelector('#owner #channel-name a, #upload-info #channel-name a');
        if (channelName) {
            const name = channelName.textContent?.trim();
            if (name && isValidName(name)) {
                names.push({ name: getFirstName(name), source: 'YouTube', confidence: 0.7 });
            }
        }
    }

    // GitHub - Get profile name
    else if (hostname.includes('github.com')) {
        const profileName = document.querySelector('[itemprop="name"], .p-name');
        if (profileName) {
            const name = profileName.textContent?.trim();
            if (name && isValidName(name)) {
                names.push({ name: getFirstName(name), source: 'GitHub', confidence: 0.8 });
            }
        }
    }

    return names;
}

