import { StorageBackend } from './storage-interface';
import { IndexDBStorage } from './indexdb-storage';
import { SupabaseStorage } from './supabase-storage';
import { ConfigManager } from '../utils/config';

export class StorageFactory {
  private static instance: StorageBackend | null = null;

  static async getStorage(): Promise<StorageBackend> {
    const config = await ConfigManager.getConfig();
    
    // Create new instance if backend changed or doesn't exist
    if (!this.instance) {
      this.instance = await this.createStorage();
    }
    
    return this.instance;
  }

  static async createStorage(): Promise<StorageBackend> {
    const config = await ConfigManager.getConfig();
    
    let storage: StorageBackend;
    
    if (config.storageBackend === 'supabase') {
      if (!config.supabaseUrl || !config.supabaseKey) {
        console.warn('Supabase credentials not found, falling back to IndexedDB');
        storage = new IndexDBStorage();
      } else {
        storage = new SupabaseStorage(config.supabaseUrl, config.supabaseKey);
      }
    } else {
      storage = new IndexDBStorage();
    }
    
    await storage.initialize();
    return storage;
  }

  static async switchStorage(): Promise<void> {
    this.instance = await this.createStorage();
  }

  static clearInstance(): void {
    this.instance = null;
  }
}

