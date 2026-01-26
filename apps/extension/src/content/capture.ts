import type { CaptureResult } from '@aether/contracts';

let active = false;
let handler: ((e: MouseEvent) => void) | null = null;

function uniqueSelector(el: Element): string {
    const parts: string[] = [];
    let current: Element | null = el;
    while (current && current.nodeType === 1 && current !== document.body) {
        const id = (current as HTMLElement).id;
        if (id) {
            parts.unshift(`#${CSS.escape(id)}`);
            break;
        }
        const cls = Array.from(current.classList).map(c => `.${CSS.escape(c)}`).join('');
        const tag = current.tagName.toLowerCase();
        const siblings = Array.from(current.parentElement?.children || []).filter(c => c.tagName === current!.tagName);
        const nth = siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(current) + 1})` : '';
        parts.unshift(`${tag}${cls}${nth}`);
        current = current.parentElement;
    }
    return parts.join(' > ') || 'body';
}

export function startCaptureMode(send: (result: CaptureResult) => void) {
    if (active) return;
    active = true;
    handler = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const target = e.target as Element;
        if (!target) return;
        const selector = uniqueSelector(target);
        const sampleText = (target.textContent || '').trim().slice(0, 200);
        send({ selector, sampleText });
        stopCaptureMode();
    };
    document.addEventListener('click', handler, true);
    document.body.style.cursor = 'crosshair';
}

export function stopCaptureMode() {
    if (!active) return;
    active = false;
    if (handler) document.removeEventListener('click', handler, true);
    handler = null;
    document.body.style.cursor = '';
}
