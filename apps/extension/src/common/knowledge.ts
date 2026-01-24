export type KnowledgeField =
    | { type: 'text'; value: string }
    | { type: 'secret'; value: string; revealPolicy?: 'mask' | 'plain' }
    | { type: 'link'; value: { label: string; url: string } };

export interface KnowledgeRecord {
    recordId: string;
    entityType: 'apartment' | 'booking' | 'guest' | 'policy';
    keys: string[]; // aliases / searchable strings
    fields: Record<string, KnowledgeField>;
    updatedAt: string; // ISO string
    sourceRef?: { kind: 'notion' | 'sfdc' | 'other'; url: string; lastEdited?: string };
    title?: string;
}
