import { AIService } from './ai-interface';
import { cleanTags } from '../utils/tag-utils';

// Chrome built-in AI API service
export class ChromeAIService implements AIService {
  private session: any = null;
  private embedder: any = null;

  async initialize(): Promise<void> {
    // Check if Chrome AI APIs are available
    if (!('ai' in window)) {
      throw new Error('Chrome AI APIs are not available. Enable chrome://flags/#optimization-guide-on-device-model');
    }

    try {
      // Initialize the language model session
      const ai = (window as any).ai;
      
      if (ai.languageModel) {
        this.session = await ai.languageModel.create({
          temperature: 0.7,
          topK: 3
        });
      }

      // Initialize embedder if available
      if (ai.embedder) {
        this.embedder = await ai.embedder.create();
      }
    } catch (error) {
      console.warn('Chrome AI initialization failed:', error);
      throw new Error('Failed to initialize Chrome AI');
    }
  }

  async isAvailable(): Promise<boolean> {
    return 'ai' in window && !!this.session;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embedder) {
      // Fallback: Create a simple hash-based embedding for demo purposes
      // In production, you'd want to use a proper embedding model
      return this.createSimpleEmbedding(text);
    }

    try {
      const result = await this.embedder.embed(text);
      return Array.from(result);
    } catch (error) {
      console.error('Embedding generation failed:', error);
      return this.createSimpleEmbedding(text);
    }
  }

  private createSimpleEmbedding(text: string, dimensions: number = 384): number[] {
    // Simple deterministic embedding based on text content
    // This is a fallback and not suitable for production semantic search
    const embedding = new Array(dimensions).fill(0);
    const words = text.toLowerCase().split(/\s+/);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (let j = 0; j < word.length; j++) {
        const charCode = word.charCodeAt(j);
        const index = (charCode * (i + 1) * (j + 1)) % dimensions;
        embedding[index] += Math.sin(charCode * 0.1) / (i + 1);
      }
    }
    
    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (norm || 1));
  }

  async generateCompletion(prompt: string, context?: string): Promise<string> {
    if (!this.session) {
      throw new Error('Chrome AI session not initialized');
    }

    try {
      const fullPrompt = context ? `Context: ${context}\n\n${prompt}` : prompt;
      const result = await this.session.prompt(fullPrompt);
      return result;
    } catch (error) {
      console.error('Completion generation failed:', error);
      throw new Error('Failed to generate completion');
    }
  }

  async generateTags(content: string): Promise<string[]> {
    if (!this.session) {
      return cleanTags(this.extractSimpleTags(content));
    }

    try {
      const prompt = `Extract 3-5 meaningful keywords/tags from this text. Output ONLY comma-separated words, no explanations:

${content.substring(0, 500)}`;

      const result = await this.session.prompt(prompt);
      const tags = result
        .trim()
        .replace(/^(tags?:|keywords?:)\s*/i, '') // Remove prefixes
        .split(/[,\n]/)
        .map((tag: string) => tag.trim())
        .filter((tag: string) => tag.length > 0);
      
      const cleaned = cleanTags(tags);
      return cleaned.length > 0 ? cleaned.slice(0, 5) : cleanTags(this.extractSimpleTags(content));
    } catch (error) {
      console.error('Tag generation failed:', error);
      return cleanTags(this.extractSimpleTags(content));
    }
  }

  private extractSimpleTags(content: string): string[] {
    // Simple keyword extraction as fallback
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });
    
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  async answerQuestion(question: string, context: string): Promise<string> {
    if (!this.session) {
      throw new Error('Chrome AI session not initialized');
    }

    try {
      const prompt = `Answer based on these notes. Be concise. If not in notes, say "No info found."

Notes:
${context.substring(0, 2000)}

Q: ${question}
A:`;

      const result = await this.session.prompt(prompt);
      return result.trim();
    } catch (error) {
      console.error('Question answering failed:', error);
      throw new Error('Failed to answer question');
    }
  }
}

