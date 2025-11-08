// AI service interface for all providers

export interface AIService {
  // Initialize the AI service
  initialize(): Promise<void>;

  // Check if the service is available
  isAvailable(): Promise<boolean>;

  // Generate embeddings for text
  generateEmbedding(text: string): Promise<number[]>;

  // Generate text completion
  generateCompletion(prompt: string, context?: string): Promise<string>;

  // Generate tags for content
  generateTags(content: string): Promise<string[]>;

  // Answer a question based on context
  answerQuestion(question: string, context: string): Promise<string>;
}

export interface EmbeddingResponse {
  embedding: number[];
  dimensions: number;
}

export interface CompletionResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

