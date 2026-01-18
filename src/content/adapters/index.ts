// src/content/adapters/index.ts

export interface InputAdapter {
    getContext(chars: number): string;
    getCoordinates(): { x: number; y: number; height: number } | null;
    insert(text: string): void;
}

// 1. Native Input Adapter (<input>, <textarea>)
class NativeAdapter implements InputAdapter {
    private el: HTMLInputElement | HTMLTextAreaElement;

    constructor(el: HTMLInputElement | HTMLTextAreaElement) {
        this.el = el;
    }

    getContext(chars: number) {
        const value = this.el.value || '';
        const start = this.el.selectionStart ?? value.length;
        const extractStart = Math.max(0, start - chars);
        return value.slice(extractStart, start);
    }

    getCoordinates() {
        const rect = this.el.getBoundingClientRect();
        return {
            x: rect.left + 10,
            y: rect.bottom,
            height: rect.height
        };
    }

    insert(text: string) {
        const start = this.el.selectionStart || 0;
        const end = this.el.selectionEnd || 0;
        this.el.setRangeText(text, start, end, 'end');
        this.el.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

// 2. ContentEditable Adapter (Gmail, WhatsApp, etc.)
class ContentEditableAdapter implements InputAdapter {
    private el: HTMLElement;

    constructor(el: HTMLElement) {
        this.el = el;
    }

    getContext(chars: number) {
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

    getCoordinates() {
        const sel = window.getSelection();
        if (!sel?.rangeCount) {
            const rect = this.el.getBoundingClientRect();
            return { x: rect.left + 10, y: rect.bottom, height: rect.height };
        }

        const range = sel.getRangeAt(0);
        const rects = range.getClientRects();

        if (rects.length > 0) {
            const rect = rects[0];
            return { x: rect.left, y: rect.bottom, height: rect.height };
        }

        const elRect = this.el.getBoundingClientRect();
        return { x: elRect.left + 10, y: elRect.bottom, height: elRect.height };
    }

    insert(text: string) {
        document.execCommand('insertText', false, text);
    }
}

// 3. Gmail-specific Adapter
class GmailAdapter extends ContentEditableAdapter {
    getContext(chars: number) {
        const sel = window.getSelection();

        if (sel?.rangeCount) {
            const range = sel.getRangeAt(0);

            if (range.startContainer.nodeType === Node.TEXT_NODE) {
                const text = range.startContainer.textContent || '';
                const end = range.startOffset;
                const start = Math.max(0, end - chars);
                return text.slice(start, end);
            }

            if (sel.focusNode?.textContent) {
                const text = sel.focusNode.textContent;
                return text.slice(-chars);
            }
        }

        return super.getContext(chars);
    }
}

// Factory Function
export function createAdapter(el: Element): InputAdapter | null {
    const tagName = el.tagName?.toUpperCase();

    if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
        console.log('⚡ Aether: Using NativeAdapter for', tagName);
        return new NativeAdapter(el as HTMLInputElement);
    }

    let current: Element | null = el;
    while (current && current !== document.body) {
        const htmlEl = current as HTMLElement;

        if (htmlEl.isContentEditable || htmlEl.getAttribute('contenteditable') === 'true') {
            const isGmail = window.location.hostname.includes('mail.google.com');
            console.log('⚡ Aether: Using', isGmail ? 'GmailAdapter' : 'ContentEditableAdapter', 'for', htmlEl.tagName);
            return isGmail ? new GmailAdapter(htmlEl) : new ContentEditableAdapter(htmlEl);
        }

        current = current.parentElement;
    }

    if (el.getAttribute('role') === 'textbox') {
        console.log('⚡ Aether: Using ContentEditableAdapter for role=textbox');
        return new ContentEditableAdapter(el as HTMLElement);
    }

    console.log('⚡ Aether: No adapter for', el.tagName, el);
    return null;
}
