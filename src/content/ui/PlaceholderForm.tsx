// src/content/ui/PlaceholderForm.tsx
// Form overlay for filling in template placeholders

import { useState, useEffect } from 'react';
import type { PlaceholderInfo } from '../../common/placeholders';
import clsx from 'clsx';

interface ExtractedName {
    name: string;
    source: string;
    confidence: number;
}

interface Props {
    placeholders: PlaceholderInfo[];
    onSubmit: (values: Record<string, string>) => void;
    onCancel: () => void;
}

export function PlaceholderForm({ placeholders, onSubmit, onCancel }: Props) {
    const [values, setValues] = useState<Record<string, string>>({});
    const [nameSuggestions, setNameSuggestions] = useState<ExtractedName[]>([]);
    const [placeholderHistory, setPlaceholderHistory] = useState<Record<string, string[]>>({});
    const [loading, setLoading] = useState(true);

    // Load name suggestions and history for all placeholders
    useEffect(() => {
        setLoading(true);

        // Load name suggestions for name-related fields
        chrome.runtime.sendMessage({ type: 'SCAN_TABS_FOR_NAMES' }, (names: ExtractedName[]) => {
            if (!chrome.runtime.lastError) {
                setNameSuggestions(names || []);
            }
        });

        // Load history for each placeholder
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

    const handleSuggestionClick = (placeholder: string, value: string) => {
        setValues(prev => ({ ...prev, [placeholder]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Save all values to history
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

    // Check if placeholder is name-related
    const isNameField = (name: string) =>
        name.includes('name') || name.includes('guest') || name.includes('recipient');

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

    return (
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-96 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-4">
                <h3 className="text-white font-semibold text-base">Fill in the placeholders</h3>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {placeholders.map((placeholder, idx) => {
                    const history = placeholderHistory[placeholder.name] || [];
                    const showNameSuggestions = isNameField(placeholder.name);
                    const showHistorySuggestions = !showNameSuggestions && history.length > 0;

                    return (
                        <div key={placeholder.name} className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                {placeholder.displayName}
                            </label>
                            <input
                                type="text"
                                value={values[placeholder.name] || ''}
                                onChange={(e) => handleChange(placeholder.name, e.target.value)}
                                placeholder={`Enter ${placeholder.displayName.toLowerCase()}...`}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                autoFocus={idx === 0}
                            />

                            {/* Name suggestions for name-related fields */}
                            {showNameSuggestions && (
                                <div className="flex flex-wrap gap-1.5">
                                    {loading ? (
                                        <span className="text-xs text-gray-400">Loading...</span>
                                    ) : nameSuggestions.length > 0 ? (
                                        nameSuggestions.map((suggestion, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => handleSuggestionClick(placeholder.name, suggestion.name)}
                                                className={clsx(
                                                    "px-2.5 py-1 text-xs rounded-full border transition-all cursor-pointer",
                                                    values[placeholder.name] === suggestion.name
                                                        ? "bg-indigo-100 border-indigo-400 text-indigo-700"
                                                        : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-indigo-50 hover:border-indigo-200"
                                                )}
                                            >
                                                <span className="font-medium">{suggestion.name}</span>
                                                <span className="text-gray-400 ml-1">· {suggestion.source}</span>
                                            </button>
                                        ))
                                    ) : (
                                        <span className="text-xs text-gray-400">No suggestions</span>
                                    )}
                                </div>
                            )}

                            {/* History suggestions for non-name fields (like links) */}
                            {showHistorySuggestions && (
                                <div className="flex flex-wrap gap-1.5">
                                    <span className="text-xs text-gray-400 w-full mb-1">Recent:</span>
                                    {history.map((item, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => handleSuggestionClick(placeholder.name, item)}
                                            className={clsx(
                                                "px-2.5 py-1 text-xs rounded-full border transition-all cursor-pointer max-w-full truncate",
                                                values[placeholder.name] === item
                                                    ? "bg-indigo-100 border-indigo-400 text-indigo-700"
                                                    : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-indigo-50 hover:border-indigo-200"
                                            )}
                                            title={item}
                                        >
                                            {item.length > 30 ? item.substring(0, 30) + '...' : item}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 py-2 px-4 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!allFilled}
                        className="flex-1 py-2 px-4 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        Insert
                    </button>
                </div>
            </form>
        </div>
    );
}
