import type { ResolvedContext, ContextConfidence, ResolverConfig } from '@aether/contracts';

declare global {
    interface Window {
        __aetherCtx?: ResolvedContext & { key?: string; reason?: string };
    }
}

const CONDUIT_HOST_SNIPPETS = ['conduit.ai', 'app.conduit.ai'];

type StrategyResult = Partial<ResolvedContext> & { evidence?: string[] };
type Strategy = () => StrategyResult | null;
type Listener = (info: ResolvedContext & { key?: string; reason?: string }) => void;

const listeners = new Set<Listener>();
let pinned: ResolvedContext | null = null;
let resolverConfigs: ResolverConfig[] = [];
let current: (ResolvedContext & { key?: string; reason?: string });
current = detectNow();
window.__aetherCtx = current;

// preload resolver configs from storage (best effort)
if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.get(['resolverConfig'], res => {
        const cfg = res?.resolverConfig as { configs?: ResolverConfig[] } | undefined;
        if (cfg?.configs) {
            resolverConfigs = cfg.configs;
            notify(detectNow());
        }
    });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.resolverConfig?.newValue) {
            const val = changes.resolverConfig.newValue as { configs?: ResolverConfig[] };
            if (val?.configs) {
                resolverConfigs = val.configs;
                notify(detectNow());
            }
        }
    });
}

function confidenceFrom(ctx: StrategyResult): ContextConfidence {
    if (ctx.bookingId) return 'high';
    if ((ctx.apartmentKeyCandidates ?? []).length) return 'medium';
    return 'low';
}

function normalize(value: string | undefined | null): string | undefined {
    return value?.trim().toLowerCase() || undefined;
}

function runStrategies(strategies: Strategy[]): StrategyResult {
    const acc: StrategyResult = { apartmentKeyCandidates: [], evidence: [] };
    for (const strat of strategies) {
        const result = strat();
        if (!result) continue;
        if (result.bookingId && !acc.bookingId) acc.bookingId = normalize(result.bookingId);
        if (result.apartmentKeyCandidates?.length) {
            const merged = [...(acc.apartmentKeyCandidates || []), ...result.apartmentKeyCandidates];
            acc.apartmentKeyCandidates = Array.from(new Set(merged.map(n => normalize(n)!).filter(Boolean)));
        }
        if (result.evidence?.length) acc.evidence = [...(acc.evidence || []), ...result.evidence];
    }
    return acc;
}

function applyTransforms(raw: string, transform?: string): string {
    const v = raw ?? '';
    switch (transform) {
        case 'digits':
            return v.replace(/\D+/g, '');
        case 'normalizeAddress':
            return v.trim().toLowerCase().replace(/\s+/g, ' ');
        case 'trimLower':
            return v.trim().toLowerCase();
        default:
            return v.trim();
    }
}

function strategyFromConfig(cfg: ResolverConfig): Strategy[] {
    return cfg.strategies.map(strat => () => {
        if (strat.type === 'urlParam') {
            const params = new URLSearchParams(window.location.search);
            const val = params.get(strat.selector || '');
            if (!val) return null;
            return {
                [strat.field]: strat.field === 'bookingId' ? applyTransforms(val, strat.transform) : [applyTransforms(val, strat.transform)],
                evidence: [`urlParam:${strat.selector}`],
                confidence: strat.confidence
            };
        }
        if (strat.type === 'attribute') {
            const el = strat.selector ? document.querySelector(strat.selector) : null;
            const val = el?.getAttribute(strat.attribute || '');
            if (!val) return null;
            const processed = applyTransforms(val, strat.transform);
            return {
                [strat.field]: strat.field === 'bookingId' ? processed : [processed],
                evidence: [`attr:${strat.selector} ${strat.attribute}`],
                confidence: strat.confidence
            };
        }
        if (strat.type === 'selectorText') {
            const el = strat.selector ? document.querySelector(strat.selector) : null;
            const text = el?.textContent?.trim();
            if (!text) return null;
            const processed = applyTransforms(text, strat.transform);
            return {
                [strat.field]: strat.field === 'bookingId' ? processed : [processed],
                evidence: [`selectorText:${strat.selector}`],
                confidence: strat.confidence
            };
        }
        if (strat.type === 'labelRegex') {
            const regex = strat.regex ? new RegExp(strat.regex) : null;
            if (!regex) return null;
            const textNodes = Array.from(document.querySelectorAll('body *'))
                .map(el => el.textContent || '')
                .filter(t => t.includes(strat.label || ''));
            for (const t of textNodes) {
                const m = t.match(regex);
                if (m && m[1]) {
                    const processed = applyTransforms(m[1], strat.transform);
                    return {
                        [strat.field]: strat.field === 'bookingId' ? processed : [processed],
                        evidence: [`labelRegex:${strat.label}`],
                        confidence: strat.confidence
                    };
                }
            }
        }
        return null;
    });
}

function pickConfig(hostname: string): ResolverConfig | undefined {
    // prefer host match
    const hostMatch = resolverConfigs.find(c => c.hosts?.some(h => hostname.includes(h)));
    if (hostMatch) return hostMatch;
    // fallback by app name snippet
    const appMatch = resolverConfigs.find(c => hostname.includes(c.app));
    if (appMatch) return appMatch;
    // fallback first
    return resolverConfigs[0];
}

function conduitStrategies(): Strategy[] {
    return [
        () => {
            const params = new URLSearchParams(window.location.search);
            const bookingId = params.get('bookingId') || params.get('reservationId') || params.get('booking') || params.get('res');
            return bookingId ? { bookingId, evidence: ['matched query param'] } : null;
        },
        () => {
            const attrs = ['data-booking-id', 'data-reservation-id', 'data-unit-id'];
            for (const attr of attrs) {
                const val = document.querySelector(`[${attr}]`)?.getAttribute(attr);
                if (val) return { bookingId: val, evidence: [`${attr}`] };
            }
            return null;
        },
        () => {
            const scripts = Array.from(document.querySelectorAll('script[type="application/json"],script[type="application/ld+json"]'));
            for (const s of scripts) {
                try {
                    const json = JSON.parse(s.textContent || '{}');
                    const candidate = json.bookingId || json.reservationId || json.id;
                    if (typeof candidate === 'string' && candidate.trim()) {
                        return { bookingId: candidate, evidence: ['embedded JSON'] };
                    }
                } catch {
                    /* ignore */
                }
            }
            return null;
        },
        () => {
            // heuristic: any element with text that looks like an address or unit code
            const candidates: string[] = [];
            const labelLookups = ['[data-unit-name]', '[data-address]', '.unit-name', '.address'];
            labelLookups.forEach(sel => {
                const text = document.querySelector(sel)?.textContent;
                if (text && text.trim().length > 3) candidates.push(text);
            });
            return candidates.length ? { apartmentKeyCandidates: candidates, evidence: ['text candidates'] } : null;
        },
        () => {
            const segments = window.location.pathname.split('/').filter(Boolean);
            const idSegment = segments.find((_, idx) => {
                const prev = segments[idx - 1] || '';
                return ['booking', 'bookings', 'reservation', 'reservations', 'unit', 'units', 'apartment', 'apartments', 'listing', 'listings'].includes(prev.toLowerCase());
            });
            if (idSegment) return { bookingId: idSegment, evidence: ['url segment'] };
            return null;
        }
    ];
}

function detectNow(): ResolvedContext & { key?: string; reason?: string } {
    if (pinned) return withLegacy(pinned, 'pinned');

    const { hostname } = window.location;
    const strategies: Strategy[] = [];

    // config-driven strategies first (app match)
    const cfg = pickConfig(hostname);
    if (cfg) {
        strategies.push(...strategyFromConfig(cfg));
    }

    if (CONDUIT_HOST_SNIPPETS.some(snippet => hostname.includes(snippet))) {
        strategies.push(...conduitStrategies());
    } else {
        // generic fallback: query params + data attrs
        strategies.push(...conduitStrategies().slice(0, 2));
    }

    const aggregate = runStrategies(strategies);
    let confidence = confidenceFrom(aggregate);
    if (cfg?.confidenceRules) {
        for (const rule of cfg.confidenceRules) {
            const okBooking = rule.requires.includes('bookingId') ? Boolean(aggregate.bookingId) : true;
            const okApts = rule.requires.includes('apartmentKeyCandidates') ? (aggregate.apartmentKeyCandidates?.length ?? 0) > 0 : true;
            if (okBooking && okApts) {
                confidence = rule.confidence;
                break;
            }
        }
    }
    const ctx: ResolvedContext = {
        app: cfg?.app || (CONDUIT_HOST_SNIPPETS.some(h => hostname.includes(h)) ? 'conduit' : 'unknown'),
        bookingId: aggregate.bookingId,
        apartmentKeyCandidates: aggregate.apartmentKeyCandidates || [],
        confidence,
        evidence: aggregate.evidence || [],
    };
    return withLegacy(ctx, aggregate.evidence?.join('; ') || undefined);
}

function withLegacy(ctx: ResolvedContext, reason?: string) {
    return {
        ...ctx,
        key: ctx.bookingId || ctx.apartmentKeyCandidates[0],
        reason,
    };
}

export function detectContext() {
    return current;
}

export function setPinnedContext(key: string, reason = 'pinned by agent') {
    pinned = {
        app: 'pinned',
        bookingId: key,
        apartmentKeyCandidates: [key],
        confidence: 'high',
        evidence: [reason],
    };
    notify(withLegacy(pinned, reason));
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

function notify(newCtx: ResolvedContext & { key?: string; reason?: string }) {
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

    const wrapHistory = (method: 'pushState' | 'replaceState') => {
        const orig = history[method];
        history[method] = function (...args) {
            const res = orig.apply(this, args as never);
            update();
            return res;
        };
    };
    wrapHistory('pushState');
    wrapHistory('replaceState');

    window.addEventListener('popstate', update);
    window.addEventListener('hashchange', update);

    const mo = new MutationObserver(() => update());
    mo.observe(document.body, { childList: true, subtree: true, attributes: true });
}

startObservers();
