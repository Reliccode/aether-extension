export type LanguageCode = 'en' | 'de';

export interface Snippet {
    id: string;
    title: string;
    content: string;
    translations: {
        de?: string;
    };
    tags: string[];
    usageCount: number;
    lastUsed: number;
}

export type AppMessage =
    | { type: 'SEARCH_QUERY'; payload: { query: string } }
    | { type: 'GET_ALL_SNIPPETS' }
    | { type: 'SAVE_SNIPPET'; payload: Omit<Snippet, 'id' | 'usageCount' | 'lastUsed'> }
    | { type: 'UPDATE_SNIPPET'; payload: { id: string; title: string; content: string; tags: string[]; translations?: { de?: string } } }
    | { type: 'DELETE_SNIPPET'; payload: { id: string } };

export type SearchResult = Snippet & { score?: number };

export type KnowledgeField =
    | { type: 'text'; value: string }
    | { type: 'secret'; value: string; revealPolicy?: 'mask' | 'plain' }
    | { type: 'link'; value: { label: string; url: string } };

export interface KnowledgeRecord {
    recordId: string;
    entityType: 'apartment' | 'booking' | 'guest' | 'policy';
    keys: string[];
    fields: Record<string, KnowledgeField>;
    updatedAt: string;
    sourceRef?: { kind: 'notion' | 'sfdc' | 'other'; url: string; lastEdited?: string };
    title?: string;
}
