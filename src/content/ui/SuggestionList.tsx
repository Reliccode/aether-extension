import { useEffect, useState } from 'react';
import type { SearchResult, LanguageCode } from '../../common/types';
import { ArrowRight, Sparkles } from 'lucide-react';
import clsx from 'clsx';

interface Props {
    results: SearchResult[];
    onSelect: (content: string, id: string) => void;
    onClose: () => void;
}

export const SuggestionList: React.FC<Props> = ({ results, onSelect, onClose }) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [viewLang, setViewLang] = useState<LanguageCode>('en');

    // Get content based on current language mode
    const getText = (item: SearchResult) => {
        if (viewLang === 'de' && item.translations?.de) {
            return item.translations.de;
        }
        return item.content;
    };

    // Handle selection with usage tracking
    const handleSelect = (item: SearchResult) => {
        chrome.runtime.sendMessage({ type: 'UPDATE_USAGE', payload: { id: item.id } });
        onSelect(getText(item), item.id);
    };

    // Keyboard Interceptor
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Prevent host page from hijacking these keys
            if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Tab'].includes(e.key)) {
                e.preventDefault();
                e.stopPropagation();
            }

            switch (e.key) {
                case 'ArrowDown':
                    setSelectedIndex((prev) => (prev + 1) % results.length);
                    break;
                case 'ArrowUp':
                    setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
                    break;
                case 'Enter':
                    if (results[selectedIndex]) {
                        handleSelect(results[selectedIndex]);
                    }
                    break;
                case 'Escape':
                    onClose();
                    break;
                case 'Tab':
                    setViewLang(prev => prev === 'en' ? 'de' : 'en');
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [results, selectedIndex, viewLang, onSelect, onClose]);

    if (results.length === 0) {
        return (
            <div className="w-96 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden font-sans">
                <div className="bg-gray-50 px-3 py-2 border-b border-gray-100 flex items-center gap-1.5 text-xs text-indigo-500 font-medium">
                    <Sparkles className="w-3 h-3" />
                    <span>AETHER</span>
                </div>
                <div className="p-6 text-center">
                    <p className="text-gray-500 text-sm mb-3">No templates found</p>
                    <button
                        onClick={() => chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' })}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                    >
                        Create Template
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-96 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col font-sans">
            {/* Header with Language Toggle */}
            <div className="bg-gray-50 px-3 py-2 border-b border-gray-100 flex items-center justify-between text-xs font-medium">
                <div className="flex items-center gap-1.5 text-indigo-500">
                    <Sparkles className="w-3 h-3" />
                    <span>AETHER</span>
                </div>

                {/* Language Switcher */}
                <div className="flex bg-gray-200 rounded-md p-0.5">
                    <button
                        onClick={() => setViewLang('en')}
                        className={clsx(
                            "px-2 py-0.5 rounded text-[10px] transition-all cursor-pointer",
                            viewLang === 'en' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                        )}
                    >
                        🇬🇧 EN
                    </button>
                    <button
                        onClick={() => setViewLang('de')}
                        className={clsx(
                            "px-2 py-0.5 rounded text-[10px] transition-all cursor-pointer",
                            viewLang === 'de' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                        )}
                    >
                        🇩🇪 DE
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="py-1 max-h-80 overflow-y-auto">
                {results.map((item, index) => {
                    const content = getText(item);
                    const isMissingTranslation = viewLang === 'de' && !item.translations?.de;

                    return (
                        <div
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={clsx(
                                'px-4 py-3 cursor-pointer flex flex-col gap-0.5 transition-colors border-l-2',
                                index === selectedIndex
                                    ? 'bg-indigo-50 border-indigo-500'
                                    : 'bg-white border-transparent hover:bg-gray-50'
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span className={clsx(
                                    'text-sm font-semibold',
                                    index === selectedIndex ? 'text-indigo-700' : 'text-gray-900',
                                    isMissingTranslation && 'opacity-50'
                                )}>
                                    {item.title}
                                </span>
                                {index === selectedIndex && <ArrowRight className="w-3 h-3 text-indigo-400" />}
                            </div>

                            <span className={clsx(
                                "text-xs leading-relaxed line-clamp-2",
                                isMissingTranslation ? "text-gray-300 italic" : "text-gray-500"
                            )}>
                                {isMissingTranslation ? "(No German translation available)" : content}
                            </span>

                            {/* Tags */}
                            <div className="flex gap-1 mt-1 flex-wrap">
                                {item.tags.slice(0, 3).map(tag => (
                                    <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer Hint */}
            <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-400 flex justify-between">
                <span>TAB to switch language</span>
                <span>↵ to insert</span>
            </div>
        </div>
    );
};
