/// <reference types="chrome"/>
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { createAdapter } from './adapters';
import type { InputAdapter } from './adapters';
import type { SearchResult } from '../common/types';
import { SuggestionList } from './ui/SuggestionList';
import { PlaceholderForm } from './ui/PlaceholderForm';
import { parseTemplate, fillTemplate, hasPlaceholders } from '../common/placeholders';

import css from './content.css?inline';

let currentHost: HTMLElement | null = null;
let currentOverlay: HTMLElement | null = null;
let root: Root | null = null;
let currentAdapter: InputAdapter | null = null;
let lastTriggerLength: number = 0;

const POPUP_HEIGHT = 300;
const POPUP_WIDTH = 384;

function getOrCreateOverlay() {
    if (currentOverlay && currentHost && document.body.contains(currentHost)) {
        return currentOverlay;
    }

    hideOverlay();

    const host = document.createElement('div');
    host.id = 'aether-overlay-host';
    host.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 0 !important;
    height: 0 !important;
    z-index: 2147483647 !important;
    pointer-events: none !important;
    overflow: visible !important;
  `;
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = css;
    shadow.appendChild(style);

    currentOverlay = document.createElement('div');
    shadow.appendChild(currentOverlay);
    currentHost = host;

    return currentOverlay;
}

let debounceTimer: number | null = null;

function handleInput(e: Event) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
        checkForTrigger(e.target as Element);
    }, 50);
}

function checkForTrigger(target: Element) {
    const adapter = createAdapter(target);
    if (!adapter) return;

    const context = adapter.getContext(30);
    const match = context.match(/\/(\w*)$/);

    if (match) {
        const query = match[1];
        lastTriggerLength = match[0].length;
        currentAdapter = adapter;

        if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;

        try {
            chrome.runtime.sendMessage(
                { type: 'SEARCH_QUERY', payload: { query } },
                (results: SearchResult[] | undefined) => {
                    if (chrome.runtime.lastError) return;

                    const coords = adapter.getCoordinates();
                    if (coords) {
                        showOverlay(coords.x, coords.y, results || []);
                    }
                }
            );
        } catch {
            // Silent fail
        }
    } else {
        hideOverlay();
    }
}

document.addEventListener('input', handleInput, true);
document.addEventListener('keyup', handleInput, true);
document.addEventListener('compositionend', handleInput, true);

// Clipboard-based insertion
async function clipboardInsert(text: string, triggerLength: number): Promise<boolean> {
    try {
        let originalClipboard = '';
        try {
            originalClipboard = await navigator.clipboard.readText();
        } catch {
            // Clipboard might be empty
        }

        if (currentAdapter) {
            currentAdapter.focus();
            currentAdapter.selectBackward(triggerLength);
        }

        await new Promise(resolve => setTimeout(resolve, 10));
        await navigator.clipboard.writeText(text);
        document.execCommand('paste');

        setTimeout(async () => {
            try {
                await navigator.clipboard.writeText(originalClipboard);
            } catch {
                // Ignore
            }
        }, 100);

        return true;
    } catch {
        return false;
    }
}

// Fallback insertion
function fallbackInsert(text: string, triggerLength: number) {
    if (!currentAdapter) return;
    currentAdapter.focus();
    currentAdapter.selectBackward(triggerLength);
    document.execCommand('insertText', false, text);
}

// Store pending template data for placeholder form
let pendingTemplate: { content: string; id: string; coords: { x: number; y: number } } | null = null;

async function handleSelect(content: string, id: string) {
    // Check if template has placeholders
    if (hasPlaceholders(content)) {
        // Get coordinates for form positioning
        const coords = currentAdapter?.getCoordinates();
        if (coords) {
            pendingTemplate = { content, id, coords };
            showPlaceholderForm(coords.x, coords.y, content);
        }
        return;
    }

    // No placeholders - insert directly
    const triggerLength = lastTriggerLength;
    const success = await clipboardInsert(content, triggerLength);
    if (!success) {
        fallbackInsert(content, triggerLength);
    }
    hideOverlay();
}

function showPlaceholderForm(x: number, y: number, content: string) {
    const container = getOrCreateOverlay();
    const placeholders = parseTemplate(content);

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let finalY = y + 8;
    if (finalY + POPUP_HEIGHT > viewportHeight) {
        finalY = Math.max(8, y - POPUP_HEIGHT - 8);
    }

    let finalX = Math.max(8, Math.min(x, viewportWidth - POPUP_WIDTH - 8));

    if (!root) root = createRoot(container);

    root.render(
        <div style={{ position: 'fixed', left: finalX, top: finalY, pointerEvents: 'auto' }}>
            <PlaceholderForm
                placeholders={placeholders}
                onSubmit={handlePlaceholderSubmit}
                onCancel={hideOverlay}
            />
        </div>
    );
}

async function handlePlaceholderSubmit(values: Record<string, string>) {
    if (!pendingTemplate) {
        hideOverlay();
        return;
    }

    // Fill template with values
    const filledContent = fillTemplate(pendingTemplate.content, values);
    const triggerLength = lastTriggerLength;

    // Track usage
    chrome.runtime.sendMessage({ type: 'UPDATE_USAGE', payload: { id: pendingTemplate.id } });

    // Insert filled template
    const success = await clipboardInsert(filledContent, triggerLength);
    if (!success) {
        fallbackInsert(filledContent, triggerLength);
    }

    pendingTemplate = null;
    hideOverlay();
}

function showOverlay(x: number, y: number, results: SearchResult[]) {
    const container = getOrCreateOverlay();

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let finalY = y + 8;
    if (finalY + POPUP_HEIGHT > viewportHeight) {
        finalY = Math.max(8, y - POPUP_HEIGHT - 8);
    }

    let finalX = Math.max(8, Math.min(x, viewportWidth - POPUP_WIDTH - 8));

    if (!root) root = createRoot(container);

    root.render(
        <div style={{ position: 'fixed', left: finalX, top: finalY, pointerEvents: 'auto' }}>
            <SuggestionList
                results={results}
                onSelect={handleSelect}
                onClose={hideOverlay}
            />
        </div>
    );
}

function hideOverlay() {
    if (root) {
        root.unmount();
        root = null;
    }

    if (currentHost?.parentNode) {
        currentHost.parentNode.removeChild(currentHost);
    }
    currentHost = null;
    currentOverlay = null;
    currentAdapter = null;
    lastTriggerLength = 0;
    pendingTemplate = null;
}
