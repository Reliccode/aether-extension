// src/content/adapters/index.ts

export interface InputAdapter {
    getContext(chars: number): string;
    getCoordinates(): { x: number; y: number; height: number } | null;
    deleteTrigger(length: number): void;
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

    deleteTrigger(length: number) {
        const start = this.el.selectionStart || 0;
        const deleteStart = Math.max(0, start - length);
        this.el.setRangeText('', deleteStart, start, 'end');
        this.el.dispatchEvent(new Event('input', { bubbles: true }));
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
    protected el: HTMLElement;

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

    deleteTrigger(length: number) {
        const sel = window.getSelection();
        if (!sel?.rangeCount) return;

        const range = sel.getRangeAt(0);

        if (range.startContainer.nodeType === Node.TEXT_NODE) {
            const textNode = range.startContainer as Text;
            const endOffset = range.startOffset;
            const startOffset = Math.max(0, endOffset - length);

            // Create a range that selects the trigger text
            const deleteRange = document.createRange();
            deleteRange.setStart(textNode, startOffset);
            deleteRange.setEnd(textNode, endOffset);

            // Delete the selected range
            deleteRange.deleteContents();

            // Collapse selection to the deletion point
            sel.removeAllRanges();
            const newRange = document.createRange();
            newRange.setStart(textNode, startOffset);
            newRange.collapse(true);
            sel.addRange(newRange);
        } else {
            // Fallback: use execCommand delete
            for (let i = 0; i < length; i++) {
                document.execCommand('delete', false);
            }
        }
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
        return new NativeAdapter(el as HTMLInputElement);
    }

    let current: Element | null = el;
    while (current && current !== document.body) {
        const htmlEl = current as HTMLElement;

        if (htmlEl.isContentEditable || htmlEl.getAttribute('contenteditable') === 'true') {
            const isGmail = window.location.hostname.includes('mail.google.com');
            return isGmail ? new GmailAdapter(htmlEl) : new ContentEditableAdapter(htmlEl);
        }

        current = current.parentElement;
    }

    if (el.getAttribute('role') === 'textbox') {
        return new ContentEditableAdapter(el as HTMLElement);
    }

    return null;
}
