import { knowledgeSeed } from '../common/knowledgeSeed';
import type { KnowledgeRecord, ResolvedContext } from '@aether/contracts';
import Fuse from 'fuse.js';
import { loadAllRecords, replaceAllRecords } from './knowledgeDb';

type Listener = (records: KnowledgeRecord[]) => void;

class KnowledgeStore {
    private records: KnowledgeRecord[] = knowledgeSeed;
    private fuse: Fuse<KnowledgeRecord>;
    private listeners = new Set<Listener>();
    private initialized = false;

    constructor() {
        this.fuse = this.createFuse(this.records);
        void this.init();
    }

    private createFuse(records: KnowledgeRecord[]) {
        return new Fuse(records, { keys: ['title', 'keys'], threshold: 0.3 });
    }

    private notify() {
        this.listeners.forEach(l => l(this.records));
    }

    async init() {
        if (this.initialized) return;
        this.initialized = true;
        try {
            const fromDb = await loadAllRecords();
            if (fromDb.length > 0) {
                this.records = fromDb;
                this.fuse = this.createFuse(this.records);
                this.notify();
            } else {
                // seed DB on first run
                await replaceAllRecords(this.records);
            }
        } catch {
            // ignore DB failures; fall back to seed
        }
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        listener(this.records);
        return () => this.listeners.delete(listener);
    }

    search(query: string): KnowledgeRecord[] {
        if (!query.trim()) return this.records.slice(0, 5);
        return this.fuse.search(query).map(r => r.item).slice(0, 10);
    }

    findByKey(key: string): KnowledgeRecord[] {
        const needle = key.toLowerCase();
        return this.records.filter(r => r.keys.some(k => k.toLowerCase().includes(needle)));
    }

    resolveContext(ctx: ResolvedContext | null): KnowledgeRecord[] {
        if (!ctx) return [];
        if (ctx.bookingId) {
            const exact = this.records.filter(r =>
                r.keys.some(k => k.toLowerCase() === ctx.bookingId!.toLowerCase())
            );
            if (exact.length) return exact;
        }
        const candidates = ctx.apartmentKeyCandidates || [];
        const collected: KnowledgeRecord[] = [];
        for (const cand of candidates) {
            const matches = this.fuse.search(cand).map(r => r.item);
            for (const m of matches) {
                if (!collected.find(r => r.recordId === m.recordId)) {
                    collected.push(m);
                }
            }
            if (collected.length >= 3) break;
        }
        return collected;
    }

    getAll(): KnowledgeRecord[] {
        return this.records;
    }

    async loadPack(records: KnowledgeRecord[]) {
        this.records = records;
        this.fuse = this.createFuse(records);
        this.notify();
        try {
            await replaceAllRecords(records);
        } catch {
            // ignore persistence error; in-memory still updated
        }
    }
}

export const knowledgeStore = new KnowledgeStore();
