import type { KnowledgeRecord } from '@aether/contracts';

export const knowledgeSeed: KnowledgeRecord[] = [
    {
        recordId: 'apt-sds46',
        entityType: 'apartment',
        title: 'Simon-Dach-Str 46 (Berlin)',
        keys: ['simon dach 46', 'sds46', 'berlin apt', 'listing-2345'],
        fields: {
            keybox_code: { type: 'secret', value: '7391', revealPolicy: 'mask', auditOnReveal: true },
            wifi_name: { type: 'text', value: 'SDS-Guest' },
            wifi_password: { type: 'secret', value: 'stay-cozy', revealPolicy: 'mask', auditOnReveal: true },
            parking: { type: 'text', value: 'Parking spot #12 behind building; gate code 5555' },
        },
        updatedAt: '2024-12-01T00:00:00Z',
        sourceRef: { kind: 'notion', url: 'https://notion.so/example/apartment-sds46', lastEdited: '2024-12-01T00:00:00Z' },
    },
    {
        recordId: 'apt-nyc-wb12',
        entityType: 'apartment',
        title: 'West Broadway 12 (NYC)',
        keys: ['west broadway 12', 'wb12', 'nyc loft'],
        fields: {
            keybox_code: { type: 'secret', value: '0042', revealPolicy: 'mask', auditOnReveal: true },
            wifi_name: { type: 'text', value: 'WB12-Loft' },
            wifi_password: { type: 'secret', value: 'broadway-fast', revealPolicy: 'mask', auditOnReveal: true },
            parking: { type: 'text', value: 'Paid garage across street; validate ticket at front desk' },
        },
        updatedAt: '2024-11-20T00:00:00Z',
        sourceRef: { kind: 'notion', url: 'https://notion.so/example/wb12', lastEdited: '2024-11-20T00:00:00Z' },
    }
];
