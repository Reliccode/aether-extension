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
        currentAdapter = adapter;

        if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;

        try {
            chrome.runtime.sendMessage(
                { type: 'SEARCH_QUERY', payload: { query } },
                (results: SearchResult[] | undefined) => {
                    if (chrome.runtime.lastError) return;

                    const coords = adapter.getCoordinates();
                    if (coords) {
                        // Always show overlay, even if no results
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

function handleSelect(content: string, _id: string) {
    if (currentAdapter) {
        const context = currentAdapter.getContext(30);
        const match = context.match(/\/\w*$/);
        if (match) {
            const triggerLength = match[0].length;
            for (let i = 0; i < triggerLength; i++) {
                document.execCommand('delete', false);
            }
        }
        currentAdapter.insert(content);
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
}
