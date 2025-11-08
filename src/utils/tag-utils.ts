// Tag cleaning utility - removes stopwords and punctuation

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'will', 'with', 'this', 'but', 'they', 'have', 'had',
  'what', 'when', 'where', 'who', 'which', 'why', 'how', 'or', 'can',
  'do', 'does', 'did', 'been', 'being', 'am', 'were', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'not', 'no', 'yes', 'so'
]);

export function cleanTags(tags: string[]): string[] {
  return tags
    .map(tag => {
      // Remove all punctuation and special characters
      let cleaned = tag
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // Keep only alphanumeric, spaces, and hyphens
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
        .trim();
      
      return cleaned;
    })
    .filter(tag => {
      // Filter out empty, too short, too long, numeric-only, or stopwords
      if (!tag || tag.length < 2 || tag.length > 30) return false;
      if (/^\d+$/.test(tag)) return false; // No pure numbers
      if (STOPWORDS.has(tag)) return false;
      
      // Check if it's mostly stopwords (for multi-word tags)
      const words = tag.split('-');
      const nonStopWords = words.filter(w => !STOPWORDS.has(w));
      return nonStopWords.length > 0;
    })
    // Remove duplicates
    .filter((tag, index, self) => self.indexOf(tag) === index);
}

