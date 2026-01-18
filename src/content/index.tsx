/// <reference types="chrome"/>
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { createAdapter } from './adapters';
import type { InputAdapter } from './adapters';
import type { SearchResult } from '../common/types';
import { SuggestionList } from './ui/SuggestionList';

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
        lastTriggerLength = match[0].length; // Store trigger length for later
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

// Clipboard-based insertion - works universally
async function clipboardInsert(text: string, triggerLength: number): Promise<boolean> {
    try {
        // 1. Save original clipboard content
        let originalClipboard = '';
        try {
            originalClipboard = await navigator.clipboard.readText();
        } catch {
            // Clipboard might be empty or inaccessible
        }

        // 2. Focus and select the trigger text
        if (currentAdapter) {
            currentAdapter.focus();
            currentAdapter.selectBackward(triggerLength);
        }

        // 3. Small delay to ensure selection is registered
        await new Promise(resolve => setTimeout(resolve, 10));

        // 4. Copy template to clipboard
        await navigator.clipboard.writeText(text);

        // 5. Execute paste - this replaces the selected trigger with the template
        document.execCommand('paste');

        // 6. Restore original clipboard after a short delay
        setTimeout(async () => {
            try {
                await navigator.clipboard.writeText(originalClipboard);
            } catch {
                // Ignore clipboard restore errors
            }
        }, 100);

        return true;
    } catch (error) {
        console.error('Clipboard insert failed:', error);
        return false;
    }
}

// Fallback insertion for when clipboard fails
function fallbackInsert(text: string, triggerLength: number) {
    if (!currentAdapter) return;

    currentAdapter.focus();
    currentAdapter.selectBackward(triggerLength);

    // Try execCommand insertText
    const success = document.execCommand('insertText', false, text);

    if (!success) {
        // Last resort: just insert at cursor without deleting trigger
        document.execCommand('insertText', false, text);
    }
}

async function handleSelect(content: string, _id: string) {
    const triggerLength = lastTriggerLength;

    // Try clipboard-based insertion first
    const success = await clipboardInsert(content, triggerLength);

    if (!success) {
        // Fallback to execCommand
        fallbackInsert(content, triggerLength);
    }

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
}
