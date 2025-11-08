// Configuration types and utilities
export interface AppConfig {
  storageBackend: 'indexdb' | 'supabase';
  aiProvider: 'chrome' | 'openai' | 'gemini';
  supabaseUrl?: string;
  supabaseKey?: string;
  openaiKey?: string;
  geminiKey?: string;
}

export const DEFAULT_CONFIG: AppConfig = {
  storageBackend: 'indexdb',
  aiProvider: 'chrome'
};

export class ConfigManager {
  static async getConfig(): Promise<AppConfig> {
    const result = await chrome.storage.sync.get('config');
    return { ...DEFAULT_CONFIG, ...(result.config || {}) };
  }

  static async setConfig(config: Partial<AppConfig>): Promise<void> {
    const currentConfig = await this.getConfig();
    const newConfig = { ...currentConfig, ...config };
    await chrome.storage.sync.set({ config: newConfig });
  }

  static async resetConfig(): Promise<void> {
    await chrome.storage.sync.set({ config: DEFAULT_CONFIG });
  }
}

