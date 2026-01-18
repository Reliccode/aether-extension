import { useEffect, useState } from 'react';
import type { Snippet } from './common/types';
import { Sparkles, Settings, Plus, ExternalLink } from 'lucide-react';

export default function Popup() {
    const [snippets, setSnippets] = useState<Snippet[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        chrome.runtime.sendMessage({ type: 'GET_ALL_SNIPPETS' }, (response: Snippet[]) => {
            if (chrome.runtime.lastError) {
                setLoading(false);
                return;
            }
            const sorted = (response || []).sort((a, b) => b.usageCount - a.usageCount).slice(0, 5);
            setSnippets(sorted);
            setLoading(false);
        });
    }, []);

    const openDashboard = () => {
        chrome.runtime.openOptionsPage();
    };

    const insertSnippet = async (content: string) => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab.id) {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (text: string) => {
                    const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
                    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
                        const start = el.selectionStart || 0;
                        const end = el.selectionEnd || 0;
                        el.setRangeText(text, start, end, 'end');
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                    } else {
                        document.execCommand('insertText', false, text);
                    }
                },
                args: [content]
            });
            window.close();
        }
    };

    return (
        <div className="w-80 bg-white font-sans">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-bold">
                    <Sparkles className="w-4 h-4" />
                    AETHER
                </div>
                <button
                    onClick={openDashboard}
                    className="text-white/80 hover:text-white transition-colors cursor-pointer"
                    title="Open Dashboard"
                >
                    <Settings size={18} />
                </button>
            </div>

            {/* Quick Actions */}
            <div className="p-3 border-b border-gray-100">
                <button
                    onClick={openDashboard}
                    className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                    <Plus size={16} /> Create New Template
                </button>
            </div>

            {/* Templates List */}
            <div className="max-h-64 overflow-y-auto">
                <div className="px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {snippets.length > 0 ? 'Most Used Templates' : 'Your Templates'}
                </div>

                {loading ? (
                    <div className="px-4 py-8 text-center text-gray-400 text-sm">
                        Loading...
                    </div>
                ) : snippets.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-400 text-sm">
                        <p>No templates yet.</p>
                        <p className="mt-1">Click above to create your first one!</p>
                    </div>
                ) : (
                    snippets.map(snippet => (
                        <div
                            key={snippet.id}
                            onClick={() => insertSnippet(snippet.content)}
                            className="px-3 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-50 transition-colors"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-800">{snippet.title}</span>
                                <span className="text-[10px] text-gray-400">{snippet.usageCount} uses</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 truncate">
                                {snippet.content.length > 50 ? snippet.content.substring(0, 50) + '...' : snippet.content}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                <span>Type /tag anywhere to trigger</span>
                <button
                    onClick={openDashboard}
                    className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer font-medium"
                >
                    Dashboard <ExternalLink size={12} />
                </button>
            </div>
        </div>
    );
}
