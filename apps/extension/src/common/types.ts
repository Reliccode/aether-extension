export type LanguageCode = 'en' | 'de';

export interface Snippet {
    id: string;
    title: string;
    // Primary (default) text - English
    content: string;
    // Alternate translations
    translations: {
        de?: string; // German
        // es?: string; // Spanish (future)
        // fr?: string; // French (future)
    };
    tags: string[];
    usageCount: number;
    lastUsed: number;
}

// Message protocol between UI and Background
export type AppMessage =
    | { type: 'SEARCH_QUERY'; payload: { query: string } }
    | { type: 'GET_ALL_SNIPPETS' }
    | { type: 'SAVE_SNIPPET'; payload: Omit<Snippet, 'id' | 'usageCount' | 'lastUsed'> }
    | { type: 'UPDATE_SNIPPET'; payload: { id: string; title: string; content: string; tags: string[]; translations?: { de?: string } } }
    | { type: 'DELETE_SNIPPET'; payload: { id: string } };

export type SearchResult = Snippet & { score?: number };
