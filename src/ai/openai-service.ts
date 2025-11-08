import OpenAI from 'openai';
import { AIService } from './ai-interface';
import { cleanTags } from '../utils/tag-utils';

export class OpenAIService implements AIService {
  private client: OpenAI | null = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not provided');
    }

    this.client = new OpenAI({
      apiKey: this.apiKey,
      dangerouslyAllowBrowser: true // Note: In production, use a backend proxy
    });
  }

  async isAvailable(): Promise<boolean> {
    return !!this.client && !!this.apiKey;
  }

  private ensureClient(): OpenAI {
    if (!this.client) {
      throw new Error('OpenAI client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const client = this.ensureClient();

    try {
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float'
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('OpenAI embedding generation failed:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  async generateCompletion(prompt: string, context?: string): Promise<string> {
    const client = this.ensureClient();

    try {
      const messages: any[] = [];
      
      if (context) {
        messages.push({
          role: 'system',
          content: `Context: ${context}`
        });
      }
      
      messages.push({
        role: 'user',
        content: prompt
      });

      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 500
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('OpenAI completion generation failed:', error);
      throw new Error('Failed to generate completion');
    }
  }

  async generateTags(content: string): Promise<string[]> {
    const client = this.ensureClient();

    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Extract 3-5 meaningful keywords/tags. Output ONLY comma-separated words, no explanations.'
          },
          {
            role: 'user',
            content: content.substring(0, 1000)
          }
        ],
        temperature: 0.3,
        max_tokens: 30
      });

      const tagsText = response.choices[0]?.message?.content || '';
      const tags = tagsText
        .replace(/^(tags?:|keywords?:|here are|the tags are):?\s*/i, '')
        .split(/[,\n]/)
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      
      const cleaned = cleanTags(tags);
      return cleaned.slice(0, 5);
    } catch (error) {
      console.error('OpenAI tag generation failed:', error);
      throw new Error('Failed to generate tags');
    }
  }

  async answerQuestion(question: string, context: string): Promise<string> {
    const client = this.ensureClient();

    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that answers questions based on the user\'s saved notes. Answer naturally and conversationally. If the question is about what content they have, describe it clearly. If comparing items, explain the differences. Be specific and reference the actual content from the notes.'
          },
          {
            role: 'user',
            content: `Context (user's saved notes):\n${context.substring(0, 4000)}\n\nUser Question: ${question}`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      return response.choices[0]?.message?.content?.trim() || 'No response generated.';
    } catch (error) {
      console.error('OpenAI question answering failed:', error);
      throw new Error('Failed to answer question');
    }
  }
}

