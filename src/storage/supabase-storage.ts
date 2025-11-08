import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StorageBackend, Note } from './storage-interface';

export class SupabaseStorage implements StorageBackend {
  private client: SupabaseClient | null = null;
  private supabaseUrl: string;
  private supabaseKey: string;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseKey = supabaseKey;
  }

  async initialize(): Promise<void> {
    this.client = createClient(this.supabaseUrl, this.supabaseKey);
    
    // Ensure the notes table exists
    // In a production setup, you'd run this SQL in Supabase:
    // CREATE TABLE notes (
    //   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    //   content TEXT NOT NULL,
    //   embedding vector(1536),
    //   tags TEXT[],
    //   source JSONB,
    //   created_at TIMESTAMPTZ DEFAULT NOW(),
    //   updated_at TIMESTAMPTZ DEFAULT NOW()
    // );
    // CREATE INDEX ON notes USING ivfflat (embedding vector_cosine_ops);
  }

  private ensureClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  async saveNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> {
    const client = this.ensureClient();
    
    const { data, error } = await client
      .from('notes')
      .insert({
        content: note.content,
        embedding: note.embedding,
        tags: note.tags,
        source: note.source
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      content: data.content,
      embedding: data.embedding,
      tags: data.tags,
      source: data.source,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime()
    };
  }

  async getNote(id: string): Promise<Note | null> {
    const client = this.ensureClient();
    
    const { data, error } = await client
      .from('notes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return {
      id: data.id,
      content: data.content,
      embedding: data.embedding,
      tags: data.tags,
      source: data.source,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime()
    };
  }

  async getAllNotes(): Promise<Note[]> {
    const client = this.ensureClient();
    
    const { data, error } = await client
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(d => ({
      id: d.id,
      content: d.content,
      embedding: d.embedding,
      tags: d.tags,
      source: d.source,
      createdAt: new Date(d.created_at).getTime(),
      updatedAt: new Date(d.updated_at).getTime()
    }));
  }

  async deleteNote(id: string): Promise<void> {
    const client = this.ensureClient();
    
    const { error } = await client
      .from('notes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async updateNote(id: string, updates: Partial<Note>): Promise<Note> {
    const client = this.ensureClient();
    
    const { data, error } = await client
      .from('notes')
      .update({
        content: updates.content,
        embedding: updates.embedding,
        tags: updates.tags,
        source: updates.source,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      content: data.content,
      embedding: data.embedding,
      tags: data.tags,
      source: data.source,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime()
    };
  }

  async searchNotes(query: string): Promise<Note[]> {
    const client = this.ensureClient();
    
    const { data, error } = await client
      .from('notes')
      .select('*')
      .textSearch('content', query);

    if (error) throw error;

    return data.map(d => ({
      id: d.id,
      content: d.content,
      embedding: d.embedding,
      tags: d.tags,
      source: d.source,
      createdAt: new Date(d.created_at).getTime(),
      updatedAt: new Date(d.updated_at).getTime()
    }));
  }

  async searchByVector(embedding: number[], limit: number = 10): Promise<Note[]> {
    const client = this.ensureClient();
    
    // Use pgvector's cosine similarity
    const { data, error } = await client.rpc('match_notes', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: limit
    });

    if (error) throw error;

    return data.map((d: any) => ({
      id: d.id,
      content: d.content,
      embedding: d.embedding,
      tags: d.tags,
      source: d.source,
      createdAt: new Date(d.created_at).getTime(),
      updatedAt: new Date(d.updated_at).getTime()
    }));
  }

  async searchByTag(tag: string): Promise<Note[]> {
    const client = this.ensureClient();
    
    const { data, error } = await client
      .from('notes')
      .select('*')
      .contains('tags', [tag]);

    if (error) throw error;

    return data.map(d => ({
      id: d.id,
      content: d.content,
      embedding: d.embedding,
      tags: d.tags,
      source: d.source,
      createdAt: new Date(d.created_at).getTime(),
      updatedAt: new Date(d.updated_at).getTime()
    }));
  }

  async getRecentNotes(limit: number = 10): Promise<Note[]> {
    const client = this.ensureClient();
    
    const { data, error } = await client
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map(d => ({
      id: d.id,
      content: d.content,
      embedding: d.embedding,
      tags: d.tags,
      source: d.source,
      createdAt: new Date(d.created_at).getTime(),
      updatedAt: new Date(d.updated_at).getTime()
    }));
  }

  async getTags(): Promise<string[]> {
    const client = this.ensureClient();
    
    const { data, error } = await client
      .from('notes')
      .select('tags');

    if (error) throw error;

    const tagsSet = new Set<string>();
    data.forEach((note: any) => {
      note.tags?.forEach((tag: string) => tagsSet.add(tag));
    });

    return Array.from(tagsSet).sort();
  }

  async clearAll(): Promise<void> {
    const client = this.ensureClient();
    
    const { error } = await client
      .from('notes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) throw error;
  }
}

