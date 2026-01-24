// src/content/ui/PlaceholderForm.tsx
// Enhanced with rich suggestions (favicons, subtitles) and live preview

import { useState, useEffect, useMemo } from 'react';
import type { PlaceholderInfo } from '@aether/core';
import clsx from 'clsx';

interface ExtractedName {
    name: string;
    fullName: string;
    source: string;
    subtitle: string;
    favicon: string;
    confidence: number;
}

interface Props {
    placeholders: PlaceholderInfo[];
    templateContent: string;
    onSubmit: (values: Record<string, string>) => void;
    onCancel: () => void;
}

export function PlaceholderForm({ placeholders, templateContent, onSubmit, onCancel }: Props) {
    const [values, setValues] = useState<Record<string, string>>({});
    const [nameSuggestions, setNameSuggestions] = useState<ExtractedName[]>([]);
    const [placeholderHistory, setPlaceholderHistory] = useState<Record<string, string[]>>({});
    const [loading, setLoading] = useState(true);
    const [activePlaceholder, setActivePlaceholder] = useState<string | null>(
        placeholders[0]?.name || null
    );

    // Load suggestions
    useEffect(() => {
        chrome.runtime.sendMessage({ type: 'SCAN_TABS_FOR_NAMES' }, (names: ExtractedName[]) => {
            if (!chrome.runtime.lastError) {
                setNameSuggestions(names || []);
            }
        });

        const historyPromises = placeholders.map(p =>
            new Promise<{ key: string; history: string[] }>((resolve) => {
                chrome.runtime.sendMessage(
                    { type: 'GET_PLACEHOLDER_HISTORY', payload: { key: p.name } },
                    (history: string[]) => {
                        resolve({ key: p.name, history: history || [] });
                    }
                );
            })
        );

        Promise.all(historyPromises).then(results => {
            const historyMap: Record<string, string[]> = {};
            results.forEach(r => {
                historyMap[r.key] = r.history;
            });
            setPlaceholderHistory(historyMap);
            setLoading(false);
        });
    }, [placeholders]);

    const handleChange = (name: string, value: string) => {
        setValues(prev => ({ ...prev, [name]: value }));
    };

    const handleSuggestionClick = (value: string) => {
        if (activePlaceholder) {
            setValues(prev => ({ ...prev, [activePlaceholder]: value }));
            // Move to next unfilled placeholder
            const currentIdx = placeholders.findIndex(p => p.name === activePlaceholder);
            const nextUnfilled = placeholders.slice(currentIdx + 1).find(p => !values[p.name]?.trim());
            if (nextUnfilled) {
                setActivePlaceholder(nextUnfilled.name);
            }
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        Object.entries(values).forEach(([key, value]) => {
            if (value.trim()) {
                chrome.runtime.sendMessage({
                    type: 'SAVE_PLACEHOLDER_VALUE',
                    payload: { key, value }
                });
            }
        });
        onSubmit(values);
    };

    const allFilled = placeholders.every(p => values[p.name]?.trim());
    const isNameField = (name: string) =>
        name.includes('name') || name.includes('guest') || name.includes('recipient');

    // Get current suggestions based on active placeholder
    const currentSuggestions = useMemo(() => {
        if (!activePlaceholder) return [];

        if (isNameField(activePlaceholder)) {
            return nameSuggestions;
        }

        // Return history as suggestions for non-name fields
        const history = placeholderHistory[activePlaceholder] || [];
        return history.map(item => ({
            name: item,
            fullName: item,
            source: 'Recent',
            subtitle: '',
            favicon: '',
            confidence: 0.5
        }));
    }, [activePlaceholder, nameSuggestions, placeholderHistory]);

    // Keyboard handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
            }
        };
        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [onCancel]);

    // Render live preview with highlighted placeholders
    const renderPreview = () => {
        const content = templateContent;
        const segments: { text: string; type: 'text' | 'placeholder'; placeholder?: PlaceholderInfo }[] = [];
        const regex = /\{\{?([a-zA-Z_][a-zA-Z0-9_]*)\}?\}/g;
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(content)) !== null) {
            if (match.index > lastIndex) {
                segments.push({ text: content.slice(lastIndex, match.index), type: 'text' });
            }
            const name = match[1].toLowerCase();
            const placeholder = placeholders.find(p => p.name === name);
            const value = values[name];

            if (value) {
                segments.push({ text: value, type: 'text' });
            } else if (placeholder) {
                segments.push({ text: placeholder.displayName, type: 'placeholder', placeholder });
            } else {
                segments.push({ text: match[0], type: 'text' });
            }
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < content.length) {
            segments.push({ text: content.slice(lastIndex), type: 'text' });
        }

        return (
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {segments.map((seg, i) => (
                    seg.type === 'placeholder' ? (
                        <button
                            key={i}
                            type="button"
                            onClick={() => seg.placeholder && setActivePlaceholder(seg.placeholder.name)}
                            className={clsx(
                                "inline-flex items-center px-2 py-0.5 rounded border text-sm font-medium cursor-pointer transition-all mx-0.5",
                                activePlaceholder === seg.placeholder?.name
                                    ? "bg-indigo-100 border-indigo-500 text-indigo-700"
                                    : "bg-amber-50 border-amber-300 text-amber-700 hover:border-amber-400"
                            )}
                        >
                            {seg.text}
                        </button>
                    ) : (
                        <span key={i}>{seg.text}</span>
                    )
                ))}
            </div>
        );
    };

    return (
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-[400px] max-h-[70vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3">
                <h3 className="text-white font-semibold text-sm">Fill in the placeholders</h3>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                {/* Live Preview */}
                <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-b border-gray-200 max-h-28 overflow-y-auto">
                    {renderPreview()}
                </div>

                {/* Suggestions Section */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
                    {/* Active placeholder input */}
                    {activePlaceholder && (
                        <div className="space-y-2">
                            <label className="block text-xs font-medium text-gray-500">
                                {placeholders.find(p => p.name === activePlaceholder)?.displayName}
                            </label>
                            <input
                                type="text"
                                value={values[activePlaceholder] || ''}
                                onChange={(e) => handleChange(activePlaceholder, e.target.value)}
                                placeholder={`Type or select below...`}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                autoFocus
                            />
                        </div>
                    )}

                    {/* Rich Suggestions with Icons */}
                    {loading ? (
                        <div className="text-center py-3 text-sm text-gray-400">Loading suggestions...</div>
                    ) : currentSuggestions.length > 0 ? (
                        <div className="space-y-1.5">
                            {currentSuggestions.map((suggestion, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleSuggestionClick(suggestion.name)}
                                    className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all cursor-pointer text-left group"
                                >
                                    {/* Favicon or Icon */}
                                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                                        {suggestion.favicon ? (
                                            <img
                                                src={suggestion.favicon}
                                                alt=""
                                                className="w-4 h-4"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <span className="text-xs font-bold text-gray-400">
                                                {suggestion.source.charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>

                                    {/* Name and Subtitle */}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm text-gray-900 truncate">
                                            {suggestion.fullName || suggestion.name}
                                        </div>
                                        {suggestion.subtitle && (
                                            <div className="text-xs text-gray-500 truncate">
                                                {suggestion.source} · {suggestion.subtitle.length > 35
                                                    ? suggestion.subtitle.substring(0, 35) + '...'
                                                    : suggestion.subtitle}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action hint on hover */}
                                    <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="px-2 py-0.5 text-xs bg-indigo-600 text-white rounded">
                                            {placeholders.find(p => p.name === activePlaceholder)?.displayName}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-3 text-sm text-gray-400">No suggestions available</div>
                    )}

                    {/* Placeholder chips to switch between */}
                    {placeholders.length > 1 && (
                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
                            {placeholders.map(p => (
                                <button
                                    key={p.name}
                                    type="button"
                                    onClick={() => setActivePlaceholder(p.name)}
                                    className={clsx(
                                        "px-2 py-0.5 text-xs rounded-full border transition-all cursor-pointer",
                                        activePlaceholder === p.name
                                            ? "bg-indigo-100 border-indigo-400 text-indigo-700"
                                            : values[p.name]
                                                ? "bg-green-50 border-green-300 text-green-700"
                                                : "bg-gray-50 border-gray-200 text-gray-600 hover:border-indigo-200"
                                    )}
                                >
                                    {p.displayName}
                                    {values[p.name] && " ✓"}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions - Fixed at bottom */}
                <div className="flex-shrink-0 flex gap-3 px-4 py-3 bg-gray-50 border-t border-gray-200">
                    <button
                        type="submit"
                        disabled={!allFilled}
                        className="flex-1 py-2 px-4 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        Insert
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="py-2 px-4 text-sm font-medium text-gray-600 hover:text-gray-800 cursor-pointer"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
}
