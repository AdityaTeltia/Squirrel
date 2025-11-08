// Background service worker for Chrome extension
import { StorageFactory } from '../storage/storage-factory';
import { AIFactory } from '../ai/ai-factory';

// Context menu setup
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-to-notes',
    title: 'Save to AI Notes',
    contexts: ['selection']
  });

  // Set default configuration
  chrome.storage.sync.get('config', (result) => {
    if (!result.config) {
      chrome.storage.sync.set({
        config: {
          storageBackend: 'indexdb',
          aiProvider: 'chrome'
        }
      });
    }
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'save-to-notes' && info.selectionText) {
    try {
      // Get page info
      const url = tab?.url || '';
      const title = tab?.title || 'Untitled';

      // Save the note
      await saveNote(info.selectionText, url, title);

      // Show success notification (if available)
      if (chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon48.png'),
          title: 'AI Notes',
          message: 'Note saved successfully!'
        });
      }
    } catch (error) {
      console.error('Failed to save note:', error);
      // Show error notification (if available)
      if (chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon48.png'),
          title: 'AI Notes',
          message: 'Failed to save note. Please try again.'
        });
      }
    }
  }
});

// Save note with AI processing
async function saveNote(content: string, url: string, pageTitle: string): Promise<void> {
  try {
    const storage = await StorageFactory.getStorage();
    const aiService = await AIFactory.getAIService();

    // Generate embedding and tags in parallel
    const [embedding, tags] = await Promise.all([
      aiService.generateEmbedding(content),
      aiService.generateTags(content)
    ]);

    // Save to storage
    await storage.saveNote({
      content,
      embedding,
      tags,
      source: {
        url,
        title: pageTitle,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('Error saving note:', error);
    throw error;
  }
}

// Message handler for communication with UI
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender).then(sendResponse).catch(error => {
    console.error('Message handler error:', error);
    sendResponse({ error: error.message });
  });
  return true; // Keep channel open for async response
});

async function handleMessage(request: any, sender: chrome.runtime.MessageSender): Promise<any> {
  const { action, data } = request;

  switch (action) {
    case 'saveNote':
      await saveNote(data.content, data.url, data.title);
      return { success: true };

    case 'searchNotes':
      return await searchNotes(data.query);

    case 'getRecentNotes':
      return await getRecentNotes(data.limit);

    case 'deleteNote':
      return await deleteNote(data.id);

    case 'askQuestion':
      return await askQuestion(data.question);

    case 'getTags':
      return await getTags();

    case 'getConfig':
      return await chrome.storage.sync.get('config');

    case 'setConfig':
      await chrome.storage.sync.set({ config: data.config });
      // Clear instances to force recreation with new config
      StorageFactory.clearInstance();
      AIFactory.clearInstance();
      return { success: true };

    case 'deleteAllNotes':
      return await deleteAllNotes();

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

async function searchNotes(query: string) {
  try {
    const storage = await StorageFactory.getStorage();

    // Use simple text search instead of vector search to avoid irrelevant results
    const notes = await storage.searchNotes(query);

    return { notes };
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
}

async function getRecentNotes(limit: number = 10) {
  try {
    const storage = await StorageFactory.getStorage();
    const notes = await storage.getRecentNotes(limit);
    return { notes };
  } catch (error) {
    console.error('Get recent notes error:', error);
    throw error;
  }
}

async function deleteNote(id: string) {
  try {
    const storage = await StorageFactory.getStorage();
    await storage.deleteNote(id);
    return { success: true };
  } catch (error) {
    console.error('Delete note error:', error);
    throw error;
  }
}

async function askQuestion(question: string) {
  try {
    const storage = await StorageFactory.getStorage();
    const aiService = await AIFactory.getAIService();

    // Get relevant notes using vector search
    const queryEmbedding = await aiService.generateEmbedding(question);
    const relevantNotes = await storage.searchByVector(queryEmbedding, 5);

    // Combine note contents as context
    const context = relevantNotes
      .map(note => `[${note.tags.join(', ')}] ${note.content}`)
      .join('\n\n');

    // Generate answer
    const answer = await aiService.answerQuestion(question, context);

    return {
      answer,
      sources: relevantNotes.map(note => ({
        id: note.id,
        content: note.content.substring(0, 200),
        tags: note.tags
      }))
    };
  } catch (error) {
    console.error('Question answering error:', error);
    throw error;
  }
}

async function getTags() {
  try {
    const storage = await StorageFactory.getStorage();
    const tags = await storage.getTags();
    return { tags };
  } catch (error) {
    console.error('Get tags error:', error);
    throw error;
  }
}

async function deleteAllNotes() {
  try {
    const storage = await StorageFactory.getStorage();
    // Get all notes and delete them one by one
    const notes = await storage.getAllNotes();
    for (const note of notes) {
      await storage.deleteNote(note.id);
    }
    return { success: true, deletedCount: notes.length };
  } catch (error) {
    console.error('Delete all notes error:', error);
    throw error;
  }
}

// Handle extension icon click to open side panel
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

