// src/content/extractors/nameExtractor.ts
// Extract names from current page for placeholder suggestions

export interface ExtractedName {
    name: string;
    source: string;  // e.g., "WhatsApp", "Gmail", "Conduit"
    confidence: number; // 0-1, higher = more likely to be relevant
}

// Main extraction function - called by background script
export function extractNames(): ExtractedName[] {
    const hostname = window.location.hostname;
    const names: ExtractedName[] = [];

    // WhatsApp Web
    if (hostname.includes('web.whatsapp.com')) {
        names.push(...extractWhatsAppNames());
    }
    // Gmail
    else if (hostname.includes('mail.google.com')) {
        names.push(...extractGmailNames());
    }
    // Conduit.ai
    else if (hostname.includes('conduit')) {
        names.push(...extractConduitNames());
    }
    // Generic extraction for any site
    else {
        names.push(...extractGenericNames());
    }

    // Deduplicate and clean
    return deduplicateNames(names);
}

function extractWhatsAppNames(): ExtractedName[] {
    const names: ExtractedName[] = [];

    // Chat header name (current conversation)
    const chatHeader = document.querySelector('[data-testid="conversation-header"] span[title]');
    if (chatHeader) {
        const name = chatHeader.getAttribute('title');
        if (name && isValidName(name)) {
            names.push({ name: getFirstName(name), source: 'WhatsApp Chat', confidence: 1.0 });
        }
    }

    // Message sender names
    const senderNames = document.querySelectorAll('[data-testid="msg-container"] span[aria-label]');
    senderNames.forEach((el) => {
        const label = el.getAttribute('aria-label');
        if (label && isValidName(label)) {
            names.push({ name: getFirstName(label), source: 'WhatsApp', confidence: 0.8 });
        }
    });

    return names;
}

function extractGmailNames(): ExtractedName[] {
    const names: ExtractedName[] = [];

    // To/From fields in compose
    const emailChips = document.querySelectorAll('[email]');
    emailChips.forEach((chip) => {
        const name = chip.getAttribute('name') || chip.textContent;
        if (name && isValidName(name)) {
            names.push({ name: getFirstName(name), source: 'Gmail', confidence: 0.9 });
        }
    });

    // Email thread participants
    const participants = document.querySelectorAll('[data-hovercard-id] span[email]');
    participants.forEach((el) => {
        const name = el.textContent;
        if (name && isValidName(name)) {
            names.push({ name: getFirstName(name), source: 'Gmail', confidence: 0.8 });
        }
    });

    return names;
}

function extractConduitNames(): ExtractedName[] {
    const names: ExtractedName[] = [];

    // Conduit guest name - look for common patterns
    // Header with guest name
    const headers = document.querySelectorAll('h1, h2, h3, [class*="guest"], [class*="name"]');
    headers.forEach((el) => {
        const text = el.textContent?.trim();
        if (text && isValidName(text) && text.length < 50) {
            names.push({ name: getFirstName(text), source: 'Conduit', confidence: 0.9 });
        }
    });

    // Conversation header area
    const conversationHeaders = document.querySelectorAll('[class*="conversation"] [class*="header"], [class*="chat"] [class*="header"]');
    conversationHeaders.forEach((el) => {
        const text = el.textContent?.trim();
        if (text && isValidName(text) && text.length < 30) {
            names.push({ name: getFirstName(text), source: 'Conduit', confidence: 0.95 });
        }
    });

    return names;
}

function extractGenericNames(): ExtractedName[] {
    const names: ExtractedName[] = [];

    // Page title might contain a name
    const title = document.title;
    const titleMatch = title.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    if (titleMatch && isValidName(titleMatch[1])) {
        names.push({ name: getFirstName(titleMatch[1]), source: 'Page', confidence: 0.5 });
    }

    // Look for profile/user elements
    const profileElements = document.querySelectorAll('[class*="profile"], [class*="user-name"], [class*="author"]');
    profileElements.forEach((el) => {
        const text = el.textContent?.trim();
        if (text && isValidName(text) && text.length < 30) {
            names.push({ name: getFirstName(text), source: 'Page', confidence: 0.6 });
        }
    });

    return names;
}

// Helper: Check if string looks like a valid name
function isValidName(str: string): boolean {
    if (!str || str.length < 2 || str.length > 50) return false;

    // Should contain at least one letter
    if (!/[a-zA-Z]/.test(str)) return false;

    // Should not be a phone number or email
    if (/^\+?\d[\d\s-]+$/.test(str)) return false;
    if (/@/.test(str)) return false;

    // Should not be common non-name words
    const blacklist = ['you', 'me', 'admin', 'support', 'team', 'hello', 'hi', 'hey'];
    if (blacklist.includes(str.toLowerCase())) return false;

    return true;
}

// Helper: Extract first name from full name
function getFirstName(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    return parts[0];
}

// Helper: Deduplicate names, keeping highest confidence
function deduplicateNames(names: ExtractedName[]): ExtractedName[] {
    const seen = new Map<string, ExtractedName>();

    for (const item of names) {
        const key = item.name.toLowerCase();
        const existing = seen.get(key);
        if (!existing || item.confidence > existing.confidence) {
            seen.set(key, item);
        }
    }

    // Sort by confidence descending, limit to 5
    return Array.from(seen.values())
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);
}

// Expose to window for injection from background script
(window as unknown as { __aether_extractNames: () => ExtractedName[] }).__aether_extractNames = extractNames;
