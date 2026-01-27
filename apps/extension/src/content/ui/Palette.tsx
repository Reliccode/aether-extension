import { useEffect, useMemo, useState } from 'react';
import type { KnowledgeField, KnowledgeRecord } from '@aether/contracts';
import clsx from 'clsx';
import { renderFieldValue, shouldMask } from './paletteUtils';
import type { ContextInfo } from '../context';

interface Props {
    records: KnowledgeRecord[];
    onClose: () => void;
    contextKey?: string;
    contextReason?: string;
}

function readWindowContext(): Pick<ContextInfo, 'key' | 'reason'> | undefined {
    try {
        const ctx = (window as Window & { __aetherCtx?: ContextInfo }).__aetherCtx;
        if (ctx?.key) return { key: ctx.key, reason: ctx.reason };
    } catch {
        // ignore
    }
    return undefined;
}

export function Palette({ records, onClose, contextKey, contextReason }: Props) {
    const [query, setQuery] = useState('');
    const [highlight, setHighlight] = useState(0);
    const [revealed, setRevealed] = useState<Record<string, boolean>>({});
    const fallbackCtx = readWindowContext();
    const effectiveContextKey = contextKey || fallbackCtx?.key;
    const effectiveContextReason = contextReason || fallbackCtx?.reason;

    const results = useMemo(() => {
        const base = effectiveContextKey
            ? records.filter(r => r.keys.some(k => k.toLowerCase().includes(effectiveContextKey.toLowerCase())))
            : records;

        if (!query.trim()) return base.slice(0, 8);
        const q = query.toLowerCase();
        return base
            .filter(r => (r.title || '').toLowerCase().includes(q) || r.keys.some(k => k.toLowerCase().includes(q)))
            .slice(0, 8);
    }, [query, records, effectiveContextKey]);

    const activeRecord = results[highlight] || results[0];

    const copyAllFields = async (rec: KnowledgeRecord) => {
        const fields = Object.entries(rec.fields)
            .map(([k, v]) => `${k}: ${renderFieldValue(v, true)}`)
            .join('\n');
        try {
            await navigator.clipboard.writeText(fields);
        } catch {
            // ignore clipboard failures
        }
    };

    const copyField = async (field: KnowledgeField) => {
        const val = field.type === 'secret' ? field.value : renderFieldValue(field, true);
        try {
            await navigator.clipboard.writeText(val);
        } catch {
            // ignore clipboard failures (sandboxed pages)
        }
    };

    const toggleReveal = (field: KnowledgeField) => {
        if (field.type !== 'secret') return;
        setRevealed(prev => ({ ...prev, [field.value]: !prev[field.value] }));
    };

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
            if (results.length === 0) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlight((h) => (h + 1) % results.length);
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlight((h) => (h - 1 + results.length) % results.length);
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                if (results[highlight]) {
                    copyAllFields(results[highlight]).catch(() => {});
                    onClose();
                }
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
                const rec = results[highlight];
                if (rec) copyAllFields(rec).catch(() => {});
            }
        };
        window.addEventListener('keydown', handler, { capture: true });
        return () => window.removeEventListener('keydown', handler, { capture: true });
    }, [highlight, onClose, results, revealed]);

    return (
        <div className="aether-palette shadow-2xl" role="dialog" aria-modal="true" style={{ pointerEvents: 'auto' }}>
            <div className="aether-palette__header">
                <input
                    autoFocus
                    placeholder="Search knowledge..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="aether-palette__search"
                />
                <button className="aether-palette__close" onClick={onClose} aria-label="Close">×</button>
            </div>
            {effectiveContextKey && (
                <div className="aether-palette__context">
                    <span className="aether-pill">Context</span>
                    <span className="aether-context__key">{effectiveContextKey}</span>
                    {effectiveContextReason && <span className="aether-context__reason">{effectiveContextReason}</span>}
                </div>
            )}
            <div className="aether-palette__grid">
                <div className="aether-palette__body" role="listbox">
                    {results.length === 0 && <div className="aether-palette__empty">No records</div>}
                    {results.map((rec, idx) => (
                        <div
                            key={rec.recordId}
                            role="option"
                            aria-selected={idx === highlight}
                            className={clsx('aether-palette__row', idx === highlight && 'is-active')}
                            onMouseEnter={() => setHighlight(idx)}
                        >
                            <div className="aether-palette__title">{rec.title || rec.keys[0]}</div>
                            <div className="aether-palette__meta">{rec.entityType} • updated {new Date(rec.updatedAt).toLocaleDateString()}</div>
                        </div>
                    ))}
                </div>
                <div className="aether-palette__details">
                    {!activeRecord && <div className="aether-palette__empty">Select a record</div>}
                    {activeRecord && (
                        <>
                            <div className="aether-palette__detail-title">{activeRecord.title || activeRecord.keys[0]}</div>
                            <div className="aether-palette__detail-actions">
                                <button className="aether-chip" onClick={() => copyAllFields(activeRecord)}>Copy all</button>
                            </div>
                            <div className="aether-palette__fields">
                                {Object.entries(activeRecord.fields).map(([key, field]) => (
                                    <div key={key} className="aether-field">
                                        <div className="aether-field__label">
                                            <span>{key}</span>
                                            {field.type === 'secret' && <span className="aether-pill">Secret</span>}
                                        </div>
                                        <div className="aether-field__value">
                                            {renderFieldValue(field, !shouldMask(field, field.type === 'secret' ? revealed[field.value] ?? false : false))}
                                        </div>
                                        <div className="aether-field__actions">
                                            {field.type === 'secret' && (
                                                <button
                                                    className="aether-chip"
                                                    onClick={() => toggleReveal(field)}
                                                >
                                                    {revealed[field.value] ? 'Hide' : 'Reveal'}
                                                </button>
                                            )}
                                            <button className="aether-chip" onClick={() => copyField(field)}>Copy</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
            <div className="aether-palette__hint">Enter: copy all fields • Esc: close • Arrows: navigate</div>
        </div>
    );
}
