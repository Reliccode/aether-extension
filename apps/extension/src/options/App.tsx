import { useEffect, useState, useRef } from 'react';
import type { Snippet, LanguageCode } from '@aether/contracts';
import { Plus, Search, Save, Trash2, Tag, Sparkles, Globe, Download, Upload } from 'lucide-react';
import clsx from 'clsx';
import { loadAllRecords } from '../content/knowledgeDb';

export default function App() {
    const [snippets, setSnippets] = useState<Snippet[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [knowledgeSummary, setKnowledgeSummary] = useState<{ count: number; latest?: string }>({ count: 0 });
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form State
    const [formTitle, setFormTitle] = useState('');
    const [formContent, setFormContent] = useState('');
    const [formContentDE, setFormContentDE] = useState('');
    const [formTags, setFormTags] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Editor language tab
    const [editorLang, setEditorLang] = useState<LanguageCode>('en');

    // Load Data
    const refreshData = () => {
        chrome.runtime.sendMessage({ type: 'GET_ALL_SNIPPETS' }, (response: Snippet[]) => {
            if (chrome.runtime.lastError) {
                console.error('Error loading snippets:', chrome.runtime.lastError);
                setLoading(false);
                return;
            }
            const sorted = (response || []).sort((a, b) => b.lastUsed - a.lastUsed);
            setSnippets(sorted);
            setLoading(false);
        });
    };

    useEffect(() => { refreshData(); }, []);
    useEffect(() => {
        (async () => {
            try {
                const records = await loadAllRecords();
                const latest = records.reduce<string | undefined>((acc, rec) => {
                    if (!acc || new Date(rec.updatedAt) > new Date(acc)) return rec.updatedAt;
                    return acc;
                }, undefined);
                setKnowledgeSummary({ count: records.length, latest });
            } catch {
                setKnowledgeSummary({ count: 0, latest: undefined });
            }
        })();
    }, []);

    // Handle Selection
    useEffect(() => {
        if (selectedId === 'new') {
            setFormTitle('');
            setFormContent('');
            setFormContentDE('');
            setFormTags('');
            setEditorLang('en');
        } else if (selectedId) {
            const found = snippets.find(s => s.id === selectedId);
            if (found) {
                setFormTitle(found.title);
                setFormContent(found.content);
                setFormContentDE(found.translations?.de || '');
                setFormTags(found.tags.join(', '));
            }
        }
    }, [selectedId, snippets]);

    // Save Handler
    const handleSave = () => {
        if (!formTitle.trim() || !formContent.trim()) return;

        setIsSaving(true);
        const tags = formTags.split(',').map(t => t.trim()).filter(Boolean);

        if (selectedId === 'new') {
            chrome.runtime.sendMessage({
                type: 'SAVE_SNIPPET',
                payload: {
                    title: formTitle,
                    content: formContent,
                    tags,
                    translations: { de: formContentDE || undefined }
                }
            }, (saved: Snippet) => {
                setIsSaving(false);
                if (saved) {
                    refreshData();
                    setSelectedId(saved.id);
                }
            });
        } else {
            chrome.runtime.sendMessage({
                type: 'UPDATE_SNIPPET',
                payload: {
                    id: selectedId,
                    title: formTitle,
                    content: formContent,
                    tags,
                    translations: { de: formContentDE || undefined }
                }
            }, () => {
                setIsSaving(false);
                refreshData();
            });
        }
    };

    // Delete Handler
    const handleDelete = () => {
        if (!selectedId || selectedId === 'new') return;
        if (!confirm('Are you sure you want to delete this template?')) return;

        chrome.runtime.sendMessage({ type: 'DELETE_SNIPPET', payload: { id: selectedId } }, () => {
            refreshData();
            setSelectedId(null);
        });
    };

    // Export Handler
    const handleExport = () => {
        const exportData = {
            version: 1,
            exportedAt: new Date().toISOString(),
            templates: snippets
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aether-templates-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Import Handler
    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                const templates = data.templates || data; // Support both formats

                if (!Array.isArray(templates)) {
                    alert('Invalid file format. Expected an array of templates.');
                    return;
                }

                const count = templates.length;
                if (!confirm(`Import ${count} templates? This will add to your existing templates.`)) {
                    return;
                }

                // Import each template
                let imported = 0;
                for (const template of templates) {
                    await new Promise<void>((resolve) => {
                        chrome.runtime.sendMessage({
                            type: 'SAVE_SNIPPET',
                            payload: {
                                title: template.title || 'Untitled',
                                content: template.content || '',
                                tags: template.tags || [],
                                translations: template.translations || {}
                            }
                        }, () => {
                            imported++;
                            resolve();
                        });
                    });
                }

                alert(`Successfully imported ${imported} templates!`);
                refreshData();
            } catch {
                alert('Failed to parse file. Please ensure it\'s a valid JSON export.');
            }
        };
        reader.readAsText(file);
        // Reset input so same file can be imported again
        e.target.value = '';
    };

    const filteredSnippets = snippets.filter(s =>
        s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const activeSnippet = snippets.find(s => s.id === selectedId);

    return (
        <div className="flex h-screen w-screen bg-white overflow-hidden font-sans text-slate-900">

            {/* SIDEBAR */}
            <div className="w-80 flex-shrink-0 border-r border-slate-200 flex flex-col bg-slate-50">
                <div className="p-4 border-b border-slate-200">
                    <div className="flex items-center gap-2 mb-4 text-indigo-600 font-bold text-lg tracking-tight">
                        <Sparkles className="w-5 h-5" />
                        AETHER
                    </div>

                    <button
                        onClick={() => setSelectedId('new')}
                        className="w-full bg-white border border-slate-300 hover:border-indigo-500 hover:text-indigo-600 text-slate-600 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                    >
                        <Plus size={16} /> New Template
                    </button>

                    <div className="relative mt-3">
                        <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                        <input
                            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            placeholder="Search library..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {loading ? (
                        <div className="p-4 text-center text-slate-400 text-sm">Loading...</div>
                    ) : filteredSnippets.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-sm">
                            {searchTerm ? 'No matches found' : 'No templates yet'}
                        </div>
                    ) : (
                        filteredSnippets.map(snippet => (
                            <div
                                key={snippet.id}
                                onClick={() => setSelectedId(snippet.id)}
                                className={clsx(
                                    "p-3 rounded-lg cursor-pointer text-sm transition-all group border border-transparent",
                                    selectedId === snippet.id
                                        ? "bg-white border-indigo-200 shadow-sm ring-1 ring-indigo-50"
                                        : "hover:bg-white hover:border-slate-200"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={clsx("font-medium flex-1", selectedId === snippet.id ? "text-indigo-700" : "text-slate-700")}>
                                        {snippet.title}
                                    </span>
                                    {snippet.translations?.de && (
                                        <Globe size={12} className="text-green-500" />
                                    )}
                                </div>
                                <div className="text-xs text-slate-400 mt-1 truncate group-hover:text-slate-500">
                                    {snippet.content}
                                </div>
                                <div className="flex gap-1 mt-2 flex-wrap">
                                    {snippet.tags.slice(0, 3).map(tag => (
                                        <span key={tag} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                                            /{tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-slate-200 bg-white">
                    <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Knowledge Packs</div>
                    <div className="text-sm text-slate-700">Records: {knowledgeSummary.count}</div>
                    {knowledgeSummary.latest ? (
                        <div className="text-xs text-slate-500 mt-1">Last synced {new Date(knowledgeSummary.latest).toLocaleString()}</div>
                    ) : (
                        <div className="text-xs text-slate-500 mt-1">No sync yet</div>
                    )}
                </div>

                {/* Export/Import Footer */}
                <div className="p-3 border-t border-slate-200 bg-white">
                    <div className="flex gap-2">
                        <button
                            onClick={handleExport}
                            disabled={snippets.length === 0}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Upload size={14} /> Export All
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                        >
                            <Download size={14} /> Import
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json"
                            onChange={handleImport}
                            className="hidden"
                        />
                    </div>
                    <p className="text-[10px] text-slate-400 text-center mt-2">
                        {snippets.length} template{snippets.length !== 1 ? 's' : ''} saved
                    </p>
                </div>
            </div>

            {/* EDITOR AREA */}
            <div className="flex-1 flex flex-col h-full bg-white">
                {selectedId ? (
                    <>
                        {/* Toolbar */}
                        <div className="h-16 border-b border-slate-100 flex items-center justify-between px-8 bg-white">
                            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                                {selectedId === 'new' ? 'New Draft' : 'Editing'}
                            </span>
                            <div className="flex items-center gap-3">
                                {selectedId !== 'new' && (
                                    <button
                                        onClick={handleDelete}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                        title="Delete"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving || !formTitle.trim() || !formContent.trim()}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm shadow-indigo-200 disabled:opacity-50 transition-all cursor-pointer"
                                >
                                    <Save size={16} />
                                    {isSaving ? 'Saving...' : 'Save Template'}
                                </button>
                            </div>
                        </div>

                        {/* Inputs */}
                        <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full flex flex-col">
                            <input
                                className="w-full text-3xl font-bold text-slate-900 placeholder-slate-300 border-none focus:outline-none focus:ring-0 p-0 mb-6 bg-transparent"
                                value={formTitle}
                                onChange={e => setFormTitle(e.target.value)}
                                placeholder="Template Title"
                            />

                            <div className="flex items-center gap-2 mb-6 text-slate-500 bg-slate-50 p-3 rounded-lg">
                                <Tag size={14} />
                                <input
                                    className="bg-transparent border-none text-sm flex-1 focus:outline-none focus:ring-0 p-0 placeholder-slate-400"
                                    value={formTags}
                                    onChange={e => setFormTags(e.target.value)}
                                    placeholder="Tags (e.g. wifi, payment, check-in)"
                                />
                            </div>

                            {/* Language Tabs */}
                            <div className="flex items-center gap-1 mb-4 border-b border-slate-100">
                                <button
                                    onClick={() => setEditorLang('en')}
                                    className={clsx(
                                        "px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer",
                                        editorLang === 'en'
                                            ? "border-indigo-600 text-indigo-600"
                                            : "border-transparent text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    🇬🇧 English (Default)
                                </button>
                                <button
                                    onClick={() => setEditorLang('de')}
                                    className={clsx(
                                        "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 cursor-pointer",
                                        editorLang === 'de'
                                            ? "border-indigo-600 text-indigo-600"
                                            : "border-transparent text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    🇩🇪 German (DE)
                                    {formContentDE && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                                </button>
                            </div>

                            {/* Content Textarea */}
                            <textarea
                                className="w-full flex-1 min-h-[300px] text-slate-600 resize-none border border-slate-200 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base leading-relaxed bg-transparent placeholder-slate-300"
                                value={editorLang === 'en' ? formContent : formContentDE}
                                onChange={e => {
                                    if (editorLang === 'en') {
                                        setFormContent(e.target.value);
                                    } else {
                                        setFormContentDE(e.target.value);
                                    }
                                }}
                                placeholder={editorLang === 'en'
                                    ? "Type the English message..."
                                    : "Geben Sie die deutsche Nachricht ein..."
                                }
                            />

                            {activeSnippet && selectedId !== 'new' && (
                                <div className="mt-4 text-xs text-slate-400 flex gap-6">
                                    <span>Used {activeSnippet.usageCount} times</span>
                                    <span>Last used: {new Date(activeSnippet.lastUsed).toLocaleDateString()}</span>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <Search size={32} />
                        </div>
                        <p className="text-sm font-medium text-slate-400">Select a template or create a new one</p>
                    </div>
                )}
            </div>
        </div>
    );
}
