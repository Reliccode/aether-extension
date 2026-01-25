export type ContextConfidence = 'high' | 'medium' | 'none';

export interface ContextInfo {
  key?: string;
  confidence: ContextConfidence;
  reason?: string;
}

declare global {
  interface Window {
    __aetherCtx?: ContextInfo;
  }
}

const CONDUIT_HOST_SNIPPETS = ['conduit.ai', 'app.conduit.ai'];

// listeners
type Listener = (info: ContextInfo) => void;
const listeners = new Set<Listener>();
let pinned: ContextInfo | null = null;
let current: ContextInfo = detectNow();
window.__aetherCtx = current;

function detectNow(): ContextInfo {
  if (pinned) return pinned;
  const { hostname, pathname, search } = window.location;
  const hostMatch = CONDUIT_HOST_SNIPPETS.some(snippet => hostname.includes(snippet));

  // Conduit-specific extraction first
  if (hostMatch) {
    const conduit = detectConduit();
    if (conduit) return conduit;
  }

  const params = new URLSearchParams(search);
  const candidateParam = params.get('bookingId') || params.get('reservationId') || params.get('booking') || params.get('res');
  if (candidateParam) {
    return {
      key: candidateParam.trim().toLowerCase(),
      confidence: hostMatch ? 'high' : 'medium',
      reason: `matched query param${hostMatch ? ' on Conduit' : ''}`
    };
  }

  const segments = pathname.split('/').filter(Boolean);
  const idSegment = segments.find((_, idx) => {
    const prev = segments[idx - 1] || '';
    return ['booking', 'bookings', 'reservation', 'reservations', 'unit', 'units', 'apartment', 'apartments', 'listing', 'listings'].includes(prev.toLowerCase());
  });
  if (idSegment) {
    return {
      key: idSegment.toLowerCase(),
      confidence: hostMatch ? 'high' : 'medium',
      reason: `matched URL segment${hostMatch ? ' on Conduit' : ''}`
    };
  }

  const dataAttrs = ['data-booking-id', 'data-reservation-id', 'data-unit-id'];
  for (const attr of dataAttrs) {
    const el = document.querySelector(`[${attr}]`);
    const val = el?.getAttribute(attr);
    if (val) {
      return {
        key: val.toLowerCase(),
        confidence: hostMatch ? 'medium' : 'medium',
        reason: `matched ${attr}`
      };
    }
  }

  return { confidence: 'none' };
}

function detectConduit(): ContextInfo | null {
  // Common Conduit patterns: query params, data attrs, and inline JSON markers
  const params = new URLSearchParams(window.location.search);
  const paramId = params.get('bookingId') || params.get('reservationId') || params.get('booking');
  if (paramId) {
    return { key: paramId.trim().toLowerCase(), confidence: 'high', reason: 'Conduit query param' };
  }

  const dataSelectors = ['data-booking-id', 'data-reservation-id', 'data-unit-id'];
  for (const attr of dataSelectors) {
    const el = document.querySelector(`[${attr}]`);
    const val = el?.getAttribute(attr);
    if (val) {
      return { key: val.toLowerCase(), confidence: 'high', reason: `Conduit ${attr}` };
    }
  }

  // Look for embedded JSON with booking info
  const scripts = Array.from(document.querySelectorAll('script[type="application/json"],script[type="application/ld+json"]'));
  for (const s of scripts) {
    try {
      const json = JSON.parse(s.textContent || '{}');
      const candidate = json.bookingId || json.reservationId || json.id;
      if (typeof candidate === 'string' && candidate.trim()) {
        return { key: candidate.trim().toLowerCase(), confidence: 'medium', reason: 'Conduit embedded JSON' };
      }
    } catch {
      /* ignore */
    }
  }

  return null;
}

export function detectContext(): ContextInfo {
  return current;
}

export function setPinnedContext(key: string, reason = 'pinned by agent') {
  pinned = { key, confidence: 'high', reason };
  notify(pinned);
}

export function clearPinnedContext() {
  pinned = null;
  notify(detectNow());
}

export function subscribeContext(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}

function notify(newCtx: ContextInfo) {
  current = newCtx;
  window.__aetherCtx = newCtx;
  listeners.forEach(l => l(newCtx));
}

function startObservers() {
  const update = () => {
    const next = detectNow();
    const changed = next.key !== current.key || next.confidence !== current.confidence;
    if (changed) notify(next);
  };

  window.addEventListener('popstate', update);
  window.addEventListener('hashchange', update);

  const mo = new MutationObserver(() => update());
  mo.observe(document.body, { childList: true, subtree: true, attributes: true });
}

startObservers();
