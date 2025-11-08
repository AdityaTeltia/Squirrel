// Storage interface for all backends

export interface Note {
  id: string;
  content: string;
  embedding: number[];
  tags: string[];
  source: {
    url: string;
    title: string;
    timestamp: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface StorageBackend {
  // Initialize the storage backend
  initialize(): Promise<void>;

  // Note operations
  saveNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note>;
  getNote(id: string): Promise<Note | null>;
  getAllNotes(): Promise<Note[]>;
  deleteNote(id: string): Promise<void>;
  updateNote(id: string, updates: Partial<Note>): Promise<Note>;

  // Search operations
  searchNotes(query: string): Promise<Note[]>;
  searchByVector(embedding: number[], limit?: number): Promise<Note[]>;
  searchByTag(tag: string): Promise<Note[]>;

  // Utility operations
  getRecentNotes(limit?: number): Promise<Note[]>;
  getTags(): Promise<string[]>;
  clearAll(): Promise<void>;
}

