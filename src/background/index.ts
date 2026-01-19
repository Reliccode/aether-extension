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

    // Save placeholder value to history
    if (message?.type === 'SAVE_PLACEHOLDER_VALUE') {
        const { key, value } = message.payload as { key: string; value: string };
        saveToPlaceholderHistory(key, value).then(() => {
            sendResponse(true);
        }).catch(() => sendResponse(false));
        return true;
    }

    // Get placeholder history
    if (message?.type === 'GET_PLACEHOLDER_HISTORY') {
        const { key } = message.payload as { key: string };
        getPlaceholderHistory(key).then(history => {
            sendResponse(history);
        }).catch(() => sendResponse([]));
        return true;
    }

    return false;
});

// Placeholder history storage functions
const HISTORY_KEY_PREFIX = 'placeholder_history_';
const MAX_HISTORY_PER_KEY = 5;

async function saveToPlaceholderHistory(key: string, value: string): Promise<void> {
    if (!value.trim()) return;

    const storageKey = HISTORY_KEY_PREFIX + key.toLowerCase();
    const result = await chrome.storage.local.get(storageKey);
    let history: string[] = (result[storageKey] as string[] | undefined) || [];

    // Remove if already exists (to move to front)
    history = history.filter(v => v !== value);

    // Add to front
    history.unshift(value);

    // Keep only last N
    history = history.slice(0, MAX_HISTORY_PER_KEY);

    await chrome.storage.local.set({ [storageKey]: history });
}

async function getPlaceholderHistory(key: string): Promise<string[]> {
    const storageKey = HISTORY_KEY_PREFIX + key.toLowerCase();
    const result = await chrome.storage.local.get(storageKey);
    return (result[storageKey] as string[] | undefined) || [];
}

// Scan all tabs for names - Enhanced with event-driven caching
interface ExtractedName {
    name: string;
    fullName: string;
    source: string;
    subtitle: string;
    favicon: string;
    confidence: number;
}

interface CachedName extends ExtractedName {
    cachedAt: number;
    tabId: number;
}

const NAMES_CACHE_KEY = 'cached_names';
const CACHE_MAX_AGE = 30 * 60 * 1000; // 30 minutes

// URLs we care about for name extraction
const RELEVANT_URLS = [
    'web.whatsapp.com',
    'mail.google.com',
    'conduit',
    'youtube.com',
    'github.com'
];

function isRelevantUrl(url: string): boolean {
    return RELEVANT_URLS.some(pattern => url.includes(pattern));
}

// Cache management functions
async function getCachedNames(): Promise<CachedName[]> {
    const result = await chrome.storage.local.get(NAMES_CACHE_KEY);
    const names = (result[NAMES_CACHE_KEY] as CachedName[] | undefined) || [];
    const now = Date.now();
    // Filter out expired entries
    return names.filter(n => now - n.cachedAt < CACHE_MAX_AGE);
}

async function saveToCachedNames(names: ExtractedName[], tabId: number, favicon: string): Promise<void> {
    const existing = await getCachedNames();
    const now = Date.now();

    // Remove old entries from the same tab
    const filtered = existing.filter(n => n.tabId !== tabId);

    // Add new entries
    const newEntries: CachedName[] = names.map(n => ({
        ...n,
        favicon: n.favicon || favicon,
        cachedAt: now,
        tabId
    }));

    // Merge and deduplicate by name
    const merged = [...filtered, ...newEntries];
    const seen = new Map<string, CachedName>();
    for (const item of merged) {
        const key = item.name.toLowerCase();
        const existing = seen.get(key);
        if (!existing || item.confidence > existing.confidence || item.cachedAt > existing.cachedAt) {
            seen.set(key, item);
        }
    }

    // Keep only top 20 entries
    const final = Array.from(seen.values())
        .sort((a, b) => b.cachedAt - a.cachedAt)
        .slice(0, 20);

    await chrome.storage.local.set({ [NAMES_CACHE_KEY]: final });
}

// Event-driven: Extract names when user visits relevant pages
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Only process when page finishes loading
    if (changeInfo.status !== 'complete') return;
    if (!tab.url || !isRelevantUrl(tab.url)) return;

    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: extractNamesFromPage,
        });

        if (results?.[0]?.result) {
            const extracted = results[0].result as ExtractedName[];
            if (extracted.length > 0) {
                await saveToCachedNames(extracted, tabId, tab.favIconUrl || '');
            }
        }
    } catch {
        // Tab may not allow script injection (e.g., chrome:// pages)
    }
});

// Clean up cache when tab closes
chrome.tabs.onRemoved.addListener(async (tabId) => {
    const existing = await getCachedNames();
    const filtered = existing.filter(n => n.tabId !== tabId);
    await chrome.storage.local.set({ [NAMES_CACHE_KEY]: filtered });
});

// Optimized: Read from cache first, scan active tab, fallback to full scan if cache empty
async function scanTabsForNames(): Promise<ExtractedName[]> {
    try {
        // Step 1: Get cached names (instant)
        let cached = await getCachedNames();

        // Step 2: Scan ONLY the active tab for fresh data
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (activeTab?.id && activeTab.url && isRelevantUrl(activeTab.url)) {
            try {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: activeTab.id },
                    func: extractNamesFromPage,
                });

                if (results?.[0]?.result) {
                    const fresh = results[0].result as ExtractedName[];
                    fresh.forEach(item => {
                        item.favicon = activeTab.favIconUrl || '';
                        if (!item.subtitle) {
                            item.subtitle = activeTab.title || '';
                        }
                    });

                    // Save to cache
                    if (fresh.length > 0) {
                        await saveToCachedNames(fresh, activeTab.id, activeTab.favIconUrl || '');
                    }

                    // Merge fresh + cached, prioritizing fresh
                    const merged = new Map<string, ExtractedName>();
                    for (const item of cached) {
                        merged.set(item.name.toLowerCase(), item);
                    }
                    for (const item of fresh) {
                        merged.set(item.name.toLowerCase(), item);
                    }

                    return Array.from(merged.values())
                        .sort((a, b) => b.confidence - a.confidence)
                        .slice(0, 5);
                }
            } catch {
                // Fall through to check cache
            }
        }

        // Step 3: If cache is empty, do a one-time full scan of relevant tabs
        if (cached.length === 0) {
            const allTabs = await chrome.tabs.query({});
            for (const tab of allTabs) {
                if (!tab.id || !tab.url || !isRelevantUrl(tab.url)) continue;

                try {
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: extractNamesFromPage,
                    });

                    if (results?.[0]?.result) {
                        const extracted = results[0].result as ExtractedName[];
                        if (extracted.length > 0) {
                            extracted.forEach(item => {
                                item.favicon = tab.favIconUrl || '';
                                if (!item.subtitle) item.subtitle = tab.title || '';
                            });
                            await saveToCachedNames(extracted, tab.id, tab.favIconUrl || '');
                        }
                    }
                } catch {
                    // Continue to next tab
                }
            }
            // Reload cache after full scan
            cached = await getCachedNames();
        }

        // Return cached names sorted by confidence
        return cached
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
        if (!/^[A-Z][a-zA-Z\s'-]+$/.test(str)) return false;
        if (str.length < 3 && !str.includes(' ')) return false;
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

    // WhatsApp - Get current chat contact name with phone number
    if (hostname.includes('web.whatsapp.com')) {
        const chatHeader = document.querySelector('[data-testid="conversation-header"] span[title]');
        if (chatHeader) {
            const fullName = chatHeader.getAttribute('title') || '';
            if (fullName && isValidName(fullName)) {
                // Try to get phone number from chat info
                const phoneEl = document.querySelector('[data-testid="conversation-header"] span[title*="+"]');
                const phone = phoneEl?.getAttribute('title') || '';
                names.push({
                    name: getFirstName(fullName),
                    fullName,
                    source: 'WhatsApp',
                    subtitle: phone || fullName,
                    favicon: '',
                    confidence: 1.0
                });
            }
        }
    }

    // Gmail - Get recipients with email
    else if (hostname.includes('mail.google.com')) {
        const recipients = document.querySelectorAll('[data-hovercard-id] span[email]');
        recipients.forEach((el) => {
            const fullName = el.textContent?.trim() || '';
            const email = el.getAttribute('email') || '';
            if (fullName && isValidName(fullName)) {
                names.push({
                    name: getFirstName(fullName),
                    fullName,
                    source: 'Gmail',
                    subtitle: email,
                    favicon: '',
                    confidence: 0.95
                });
            }
        });
    }

    // Conduit - Get guest name
    else if (hostname.includes('conduit')) {
        const guestName = document.querySelector('p.text-title-lg, p.truncate.text-title-lg');
        if (guestName) {
            const fullName = guestName.textContent?.trim() || '';
            if (fullName && isValidName(fullName)) {
                names.push({
                    name: getFirstName(fullName),
                    fullName,
                    source: 'Conduit',
                    subtitle: 'Guest',
                    favicon: '',
                    confidence: 1.0
                });
            }
        }
    }

    // YouTube - Get video creator name with video title
    else if (hostname.includes('youtube.com')) {
        const channelName = document.querySelector('#owner #channel-name a, #upload-info #channel-name a');
        const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer, h1.ytd-watch-metadata')?.textContent?.trim();
        if (channelName) {
            const fullName = channelName.textContent?.trim() || '';
            if (fullName && isValidName(fullName)) {
                names.push({
                    name: getFirstName(fullName),
                    fullName,
                    source: 'YouTube',
                    subtitle: videoTitle || document.title,
                    favicon: '',
                    confidence: 0.7
                });
            }
        }
    }

    // GitHub - Get profile name with username
    else if (hostname.includes('github.com')) {
        const profileName = document.querySelector('[itemprop="name"], .p-name');
        const username = document.querySelector('[itemprop="additionalName"]')?.textContent?.trim();
        if (profileName) {
            const fullName = profileName.textContent?.trim() || '';
            if (fullName && isValidName(fullName)) {
                names.push({
                    name: getFirstName(fullName),
                    fullName,
                    source: 'GitHub',
                    subtitle: username ? `@${username}` : '',
                    favicon: '',
                    confidence: 0.8
                });
            }
        }
    }

    return names;
}
