// src/content/adapters/index.ts
// Simplified adapter for clipboard-based insertion

export interface InputAdapter {
    getContext(chars: number): string;
    getCoordinates(): { x: number; y: number; height: number } | null;
    selectBackward(length: number): void;
    focus(): void;
}

// Universal Adapter - works for all input types
class UniversalAdapter implements InputAdapter {
    private el: HTMLElement;
    private isNativeInput: boolean;

    constructor(el: HTMLElement) {
        this.el = el;
        this.isNativeInput = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
    }

    focus() {
        this.el.focus();
    }

    getContext(chars: number): string {
        if (this.isNativeInput) {
            const input = this.el as HTMLInputElement | HTMLTextAreaElement;
            const value = input.value || '';
            const start = input.selectionStart ?? value.length;
            const extractStart = Math.max(0, start - chars);
            return value.slice(extractStart, start);
        }

        // ContentEditable
        const sel = window.getSelection();
        if (!sel?.rangeCount) return '';

        const range = sel.getRangeAt(0);
        if (range.startContainer.nodeType === Node.TEXT_NODE) {
            const text = range.startContainer.textContent || '';
            const end = range.startOffset;
            const start = Math.max(0, end - chars);
            return text.slice(start, end);
        }

        const fullText = this.el.innerText || this.el.textContent || '';
        return fullText.slice(-chars);
    }

    getCoordinates(): { x: number; y: number; height: number } | null {
        if (this.isNativeInput) {
            const rect = this.el.getBoundingClientRect();
            return { x: rect.left + 10, y: rect.bottom, height: rect.height };
        }

        // ContentEditable - get cursor position
        const sel = window.getSelection();
        if (sel?.rangeCount) {
            const range = sel.getRangeAt(0);
            const rects = range.getClientRects();
            if (rects.length > 0) {
                const rect = rects[0];
                return { x: rect.left, y: rect.bottom, height: rect.height };
            }
        }

        const elRect = this.el.getBoundingClientRect();
        return { x: elRect.left + 10, y: elRect.bottom, height: elRect.height };
    }

    selectBackward(length: number): void {
        this.el.focus();

        if (this.isNativeInput) {
            const input = this.el as HTMLInputElement | HTMLTextAreaElement;
            const end = input.selectionStart || 0;
            const start = Math.max(0, end - length);
            input.setSelectionRange(start, end);
            return;
        }

        // ContentEditable - select text before cursor
        const sel = window.getSelection();
        if (!sel?.rangeCount) return;

        const range = sel.getRangeAt(0);
        if (range.startContainer.nodeType === Node.TEXT_NODE) {
            const textNode = range.startContainer;
            const endOffset = range.startOffset;
            const startOffset = Math.max(0, endOffset - length);

            const newRange = document.createRange();
            newRange.setStart(textNode, startOffset);
            newRange.setEnd(textNode, endOffset);

            sel.removeAllRanges();
            sel.addRange(newRange);
        }
    }
}

// Factory Function
export function createAdapter(el: Element): InputAdapter | null {
    const tagName = el.tagName?.toUpperCase();

    // Native input/textarea
    if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
        return new UniversalAdapter(el as HTMLElement);
    }

    // Find contenteditable ancestor
    let current: Element | null = el;
    while (current && current !== document.body) {
        const htmlEl = current as HTMLElement;
        if (htmlEl.isContentEditable || htmlEl.getAttribute('contenteditable') === 'true') {
            return new UniversalAdapter(htmlEl);
        }
        current = current.parentElement;
    }

    // Role=textbox fallback
    if (el.getAttribute('role') === 'textbox') {
        return new UniversalAdapter(el as HTMLElement);
    }

    return null;
}
