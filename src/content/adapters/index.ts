// src/content/adapters/index.ts

export interface InputAdapter {
    getContext(chars: number): string;
    getCoordinates(): { x: number; y: number; height: number } | null;
    deleteTrigger(length: number): void;
    insert(text: string): void;
    focus(): void;
}

// 1. Native Input Adapter (<input>, <textarea>)
class NativeAdapter implements InputAdapter {
    private el: HTMLInputElement | HTMLTextAreaElement;
    private savedStart: number = 0;

    constructor(el: HTMLInputElement | HTMLTextAreaElement) {
        this.el = el;
        this.savedStart = el.selectionStart || 0;
    }

    focus() {
        this.el.focus();
    }

    getContext(chars: number) {
        const value = this.el.value || '';
        const start = this.el.selectionStart ?? value.length;
        this.savedStart = start;
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
        this.el.focus();
        const start = this.el.selectionStart || this.savedStart;
        const deleteStart = Math.max(0, start - length);
        this.el.setRangeText('', deleteStart, start, 'end');
        this.el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    insert(text: string) {
        this.el.focus();
        const start = this.el.selectionStart || 0;
        const end = this.el.selectionEnd || 0;
        this.el.setRangeText(text, start, end, 'end');
        this.el.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

// 2. ContentEditable Adapter (Gmail, general sites)
class ContentEditableAdapter implements InputAdapter {
    protected el: HTMLElement;
    protected savedRange: Range | null = null;

    constructor(el: HTMLElement) {
        this.el = el;
        this.saveCurrentRange();
    }

    protected saveCurrentRange() {
        const sel = window.getSelection();
        if (sel?.rangeCount) {
            this.savedRange = sel.getRangeAt(0).cloneRange();
        }
    }

    focus() {
        this.el.focus();
        if (this.savedRange) {
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(this.savedRange);
        }
    }

    getContext(chars: number) {
        const sel = window.getSelection();
        if (!sel?.rangeCount) return '';

        const range = sel.getRangeAt(0);
        this.savedRange = range.cloneRange();

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
        this.el.focus();

        if (this.savedRange) {
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(this.savedRange);
        }

        const sel = window.getSelection();
        if (!sel?.rangeCount) return;

        const range = sel.getRangeAt(0);

        if (range.startContainer.nodeType === Node.TEXT_NODE) {
            const textNode = range.startContainer as Text;
            const endOffset = range.startOffset;
            const startOffset = Math.max(0, endOffset - length);

            const deleteRange = document.createRange();
            deleteRange.setStart(textNode, startOffset);
            deleteRange.setEnd(textNode, endOffset);
            deleteRange.deleteContents();

            sel.removeAllRanges();
            const newRange = document.createRange();
            newRange.setStart(textNode, startOffset);
            newRange.collapse(true);
            sel.addRange(newRange);

            this.savedRange = newRange.cloneRange();
        } else {
            for (let i = 0; i < length; i++) {
                document.execCommand('delete', false);
            }
        }
    }

    insert(text: string) {
        this.el.focus();
        document.execCommand('insertText', false, text);
    }
}

// 3. WhatsApp-specific Adapter (simplified - skip trigger deletion)
class WhatsAppAdapter implements InputAdapter {
    private el: HTMLElement;

    constructor(el: HTMLElement) {
        this.el = el;
    }

    focus() {
        this.el.focus();
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

    // WhatsApp: Skip trigger deletion - let user delete manually
    deleteTrigger(_length: number) {
        // No-op for WhatsApp - user will delete trigger manually
        // This avoids complex issues with WhatsApp's React implementation
    }

    insert(text: string) {
        this.el.focus();
        document.execCommand('insertText', false, text);
    }
}

// 4. Gmail-specific Adapter
class GmailAdapter extends ContentEditableAdapter {
    getContext(chars: number) {
        const sel = window.getSelection();

        if (sel?.rangeCount) {
            const range = sel.getRangeAt(0);
            this.savedRange = range.cloneRange();

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
            const hostname = window.location.hostname;

            // WhatsApp-specific adapter (simplified)
            if (hostname.includes('web.whatsapp.com')) {
                return new WhatsAppAdapter(htmlEl);
            }

            // Gmail-specific adapter
            if (hostname.includes('mail.google.com')) {
                return new GmailAdapter(htmlEl);
            }

            return new ContentEditableAdapter(htmlEl);
        }

        current = current.parentElement;
    }

    if (el.getAttribute('role') === 'textbox') {
        const hostname = window.location.hostname;
        if (hostname.includes('web.whatsapp.com')) {
            return new WhatsAppAdapter(el as HTMLElement);
        }
        return new ContentEditableAdapter(el as HTMLElement);
    }

    return null;
}
