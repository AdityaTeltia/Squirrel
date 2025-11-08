// Vector utility functions for similarity search

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0) {
    return 0;
  }

  // If vectors have different lengths, pad or truncate to match
  const maxLen = Math.max(a.length, b.length);
  const minLen = Math.min(a.length, b.length);
  
  // Use the shorter length to avoid errors
  const len = minLen;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

export function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return vector;
  return vector.map(val => val / norm);
}

export interface SimilarityResult<T> {
  item: T;
  similarity: number;
}

export function findTopKSimilar<T extends { embedding: number[] }>(
  query: number[],
  items: T[],
  k: number
): SimilarityResult<T>[] {
  if (!query || query.length === 0) {
    console.warn('Empty query embedding provided');
    return [];
  }

  // Filter out items with invalid embeddings
  const validItems = items.filter(item => 
    item.embedding && 
    Array.isArray(item.embedding) && 
    item.embedding.length > 0
  );

  if (validItems.length === 0) {
    console.warn('No valid embeddings found in items');
    return [];
  }

  const similarities = validItems.map(item => {
    try {
      return {
        item,
        similarity: cosineSimilarity(query, item.embedding)
      };
    } catch (error) {
      console.error('Error calculating similarity:', error);
      return {
        item,
        similarity: 0
      };
    }
  });

  similarities.sort((a, b) => b.similarity - a.similarity);
  return similarities.slice(0, k);
}

