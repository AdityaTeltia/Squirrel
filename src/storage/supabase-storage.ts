import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StorageBackend, Note } from './storage-interface';

export class SupabaseStorage implements StorageBackend {
  private client: SupabaseClient | null = null;
  private supabaseUrl: string;
  private supabaseKey: string;
  private static readonly VECTOR_DIMENSIONS = 1536; // Max dimensions (OpenAI size)

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseKey = supabaseKey;
  }

  /**
   * Normalize embedding to standard dimensions by padding with zeros if needed
   * This allows different AI providers (Gemini 768, Chrome AI 384, OpenAI 1536) to work together
   */
  private normalizeEmbedding(embedding: number[]): number[] {
    if (embedding.length === SupabaseStorage.VECTOR_DIMENSIONS) {
      return embedding;
    }
    
    if (embedding.length > SupabaseStorage.VECTOR_DIMENSIONS) {
      console.warn(`Embedding has ${embedding.length} dimensions, truncating to ${SupabaseStorage.VECTOR_DIMENSIONS}`);
      return embedding.slice(0, SupabaseStorage.VECTOR_DIMENSIONS);
    }
    
    // Pad with zeros
    const normalized = [...embedding];
    while (normalized.length < SupabaseStorage.VECTOR_DIMENSIONS) {
      normalized.push(0);
    }
    return normalized;
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
    
    // Normalize embedding dimensions
    const normalizedEmbedding = this.normalizeEmbedding(note.embedding);
    
    const { data, error } = await client
      .from('notes')
      .insert({
        content: note.content,
        embedding: normalizedEmbedding,
        tags: note.tags,
        source: note.source
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      throw new Error(`Failed to save note to Supabase: ${error.message}. ${error.hint || ''}`);
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
    
    // Normalize embedding if present
    const normalizedEmbedding = updates.embedding 
      ? this.normalizeEmbedding(updates.embedding)
      : undefined;
    
    const { data, error } = await client
      .from('notes')
      .update({
        content: updates.content,
        embedding: normalizedEmbedding,
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
    
    // Normalize query embedding dimensions
    const normalizedEmbedding = this.normalizeEmbedding(embedding);
    console.log('Supabase: Normalized embedding to', normalizedEmbedding.length, 'dimensions');
    
    // Use pgvector's cosine similarity with lower threshold
    const { data, error } = await client.rpc('match_notes', {
      query_embedding: normalizedEmbedding,
      match_threshold: 0.7, // Lowered from 0.7 for better recall
      match_count: limit
    });

    if (error) {
      console.error('Supabase RPC error:', error);
      throw error;
    }

    console.log('Supabase: match_notes returned', data?.length || 0, 'results');

    if (!data || data.length === 0) {
      return [];
    }

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

