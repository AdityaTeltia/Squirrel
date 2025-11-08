import Dexie, { Table } from 'dexie';
import { StorageBackend, Note } from './storage-interface';
import { findTopKSimilar } from '../utils/vector-utils';

class NotesDatabase extends Dexie {
  notes!: Table<Note, string>;

  constructor() {
    super('AINotesDatabase');
    this.version(1).stores({
      notes: 'id, createdAt, updatedAt, *tags, source.url'
    });
  }
}

export class IndexDBStorage implements StorageBackend {
  private db: NotesDatabase;

  constructor() {
    this.db = new NotesDatabase();
  }

  async initialize(): Promise<void> {
    // Database is initialized in constructor, but we can add any setup here
    await this.db.open();
  }

  async saveNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> {
    const now = Date.now();
    const newNote: Note = {
      ...note,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now
    };

    await this.db.notes.add(newNote);
    return newNote;
  }

  async getNote(id: string): Promise<Note | null> {
    const note = await this.db.notes.get(id);
    return note || null;
  }

  async getAllNotes(): Promise<Note[]> {
    return await this.db.notes.toArray();
  }

  async deleteNote(id: string): Promise<void> {
    await this.db.notes.delete(id);
  }

  async updateNote(id: string, updates: Partial<Note>): Promise<Note> {
    const existing = await this.db.notes.get(id);
    if (!existing) {
      throw new Error(`Note with id ${id} not found`);
    }

    const updated: Note = {
      ...existing,
      ...updates,
      id, // Ensure id doesn't change
      updatedAt: Date.now()
    };

    await this.db.notes.put(updated);
    return updated;
  }

  async searchNotes(query: string): Promise<Note[]> {
    const lowerQuery = query.toLowerCase();
    const notes = await this.db.notes.toArray();
    
    return notes.filter(note => 
      note.content.toLowerCase().includes(lowerQuery) ||
      note.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  async searchByVector(embedding: number[], limit: number = 10): Promise<Note[]> {
    const allNotes = await this.db.notes.toArray();
    const results = findTopKSimilar(embedding, allNotes, limit);
    return results.map(r => r.item);
  }

  async searchByTag(tag: string): Promise<Note[]> {
    return await this.db.notes
      .where('tags')
      .equals(tag)
      .toArray();
  }

  async getRecentNotes(limit: number = 10): Promise<Note[]> {
    return await this.db.notes
      .orderBy('createdAt')
      .reverse()
      .limit(limit)
      .toArray();
  }

  async getTags(): Promise<string[]> {
    const notes = await this.db.notes.toArray();
    const tagsSet = new Set<string>();
    
    notes.forEach(note => {
      note.tags.forEach(tag => tagsSet.add(tag));
    });
    
    return Array.from(tagsSet).sort();
  }

  async clearAll(): Promise<void> {
    await this.db.notes.clear();
  }
}

