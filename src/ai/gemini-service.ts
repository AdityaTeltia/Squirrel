import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { AIService } from './ai-interface';
import { cleanTags } from '../utils/tag-utils';

export class GeminiService implements AIService {
  private client: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not provided');
    }

    this.client = new GoogleGenerativeAI(this.apiKey);
    this.model = this.client.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  async isAvailable(): Promise<boolean> {
    return !!this.client && !!this.model && !!this.apiKey;
  }

  private ensureModel(): GenerativeModel {
    if (!this.model) {
      throw new Error('Gemini model not initialized. Call initialize() first.');
    }
    return this.model;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.client) {
      throw new Error('Gemini client not initialized');
    }

    try {
      // Use Gemini's embedding model
      const embeddingModel = this.client.getGenerativeModel({ model: 'embedding-001' });
      const result = await embeddingModel.embedContent(text);
      
      return result.embedding.values;
    } catch (error) {
      console.error('Gemini embedding generation failed:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  async generateCompletion(prompt: string, context?: string): Promise<string> {
    const model = this.ensureModel();

    try {
      const fullPrompt = context ? `Context: ${context}\n\n${prompt}` : prompt;
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Gemini completion generation failed:', error);
      throw new Error('Failed to generate completion');
    }
  }

  async generateTags(content: string): Promise<string[]> {
    const model = this.ensureModel();

    try {
      const prompt = `Extract 3-5 meaningful keywords/tags. Output ONLY comma-separated words, no explanations:

${content.substring(0, 1000)}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const tagsText = response.text();
      
      const tags = tagsText
        .trim()
        .replace(/^(tags?:|keywords?:|here are|the tags are):?\s*/i, '')
        .split(/[,\n]/)
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      
      const cleaned = cleanTags(tags);
      return cleaned.slice(0, 5);
    } catch (error) {
      console.error('Gemini tag generation failed:', error);
      throw new Error('Failed to generate tags');
    }
  }

  async answerQuestion(question: string, context: string): Promise<string> {
    const model = this.ensureModel();

    try {
      const prompt = `You are a helpful assistant that answers questions based on the user's saved notes.

Context (user's saved notes):
${context.substring(0, 4000)}

User Question: ${question}

Instructions:
- Answer naturally and conversationally
- If the question is about what content they have, describe it clearly
- If comparing items, explain the differences
- If no relevant information exists, say "I don't have any notes about that."
- Be specific and reference the actual content from the notes

Answer:`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Gemini question answering failed:', error);
      throw new Error('Failed to answer question');
    }
  }
}

