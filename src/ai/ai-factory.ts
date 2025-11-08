import { AIService } from './ai-interface';
import { ChromeAIService } from './chrome-ai-service';
import { OpenAIService } from './openai-service';
import { GeminiService } from './gemini-service';
import { ConfigManager } from '../utils/config';

export class AIFactory {
  private static instance: AIService | null = null;

  static async getAIService(): Promise<AIService> {
    const config = await ConfigManager.getConfig();
    
    // Create new instance if provider changed or doesn't exist
    if (!this.instance) {
      this.instance = await this.createAIService();
    }
    
    return this.instance;
  }

  static async createAIService(): Promise<AIService> {
    const config = await ConfigManager.getConfig();
    
    let service: AIService;
    
    switch (config.aiProvider) {
      case 'openai':
        if (!config.openaiKey) {
          console.warn('OpenAI API key not found, falling back to Chrome AI');
          service = new ChromeAIService();
        } else {
          service = new OpenAIService(config.openaiKey);
        }
        break;
      
      case 'gemini':
        if (!config.geminiKey) {
          console.warn('Gemini API key not found, falling back to Chrome AI');
          service = new ChromeAIService();
        } else {
          service = new GeminiService(config.geminiKey);
        }
        break;
      
      case 'chrome':
      default:
        service = new ChromeAIService();
        break;
    }
    
    try {
      await service.initialize();
    } catch (error) {
      console.error('Failed to initialize AI service:', error);
      // Fallback to Chrome AI if initialization fails
      if (!(service instanceof ChromeAIService)) {
        console.warn('Falling back to Chrome AI');
        service = new ChromeAIService();
        await service.initialize();
      }
    }
    
    return service;
  }

  static async switchAIService(): Promise<void> {
    this.instance = await this.createAIService();
  }

  static clearInstance(): void {
    this.instance = null;
  }
}

