// Background service worker for Chrome extension
import { StorageFactory } from '../storage/storage-factory';
import { AIFactory } from '../ai/ai-factory';

// Helper function to format timestamp
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Context menu setup
chrome.runtime.onInstalled.addListener(() => {
  // Regular text selection context menu
  chrome.contextMenus.create({
    id: 'save-to-notes',
    title: 'Save to AI Notes',
    contexts: ['selection']
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error creating save-to-notes menu:', chrome.runtime.lastError);
    } else {
      console.log('✓ Created "Save to AI Notes" context menu');
    }
  });

  // YouTube video context menu (only on video pages)
  chrome.contextMenus.create({
    id: 'save-youtube-clip',
    title: 'Save YouTube Clip',
    contexts: ['page'],
    documentUrlPatterns: ['*://www.youtube.com/watch*', '*://youtube.com/watch*']
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error creating save-youtube-clip menu:', chrome.runtime.lastError);
    } else {
      console.log('✓ Created "Save YouTube Clip" context menu');
    }
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
  console.log('Context menu clicked:', info.menuItemId, 'on tab:', tab?.url);
  
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
          title: 'Squirrel',
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
          title: 'Squirrel',
          message: 'Failed to save note. Please try again.'
        });
      }
    }
  }

  if (info.menuItemId === 'save-youtube-clip' && tab?.id && tab?.url) {
    console.log('🎥 YouTube clip save triggered!');
    
    try {
      // Simple approach: Just reload the page if content script isn't available
      // This ensures the content script is properly loaded
      
      let isContentScriptReady = false;
      
      // Try to ping the content script
      console.log('Checking if content script is ready...');
      try {
        const pingResponse = await Promise.race([
          chrome.tabs.sendMessage(tab.id, { action: 'getYouTubeInfo' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))
        ]);
        isContentScriptReady = !!pingResponse;
        console.log('✓ Content script is ready!', pingResponse);
      } catch (e) {
        console.log('✗ Content script not ready:', e);
      }

      if (!isContentScriptReady) {
        // Content script not loaded - inform user to refresh
        console.log('Asking user to refresh page...');
        if (chrome.notifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon48.png'),
            title: 'Squirrel',
            message: 'Please refresh the YouTube page (F5) and try again!'
          });
        }
        return;
      }

      // Get YouTube video info from content script
      console.log('Getting YouTube info...');
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getYouTubeInfo' });
      console.log('YouTube info:', response);
      
      if (response && response.isYouTube && response.videoId) {
        // Show loading notification
        console.log('Fetching transcript...');
        if (chrome.notifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon48.png'),
            title: 'Squirrel',
            message: 'Fetching transcript...'
          });
        }

        // Fetch transcript (with timeout)
        const transcriptResponse = await Promise.race([
          chrome.tabs.sendMessage(tab.id, { action: 'fetchTranscript' }),
          new Promise((resolve) => setTimeout(() => resolve({ transcript: '' }), 5000))
        ]) as any;
        
        const transcript = transcriptResponse?.transcript || '';
        console.log('Transcript length:', transcript.length);

        console.log('Saving YouTube clip...');
        await saveYouTubeClip({
          videoId: response.videoId,
          timestamp: response.timestamp,
          title: response.title,
          channel: response.channel,
          thumbnail: response.thumbnail,
          transcript
        });

        // Show success notification
        console.log('✓ YouTube clip saved successfully!');
        if (chrome.notifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon48.png'),
            title: 'Squirrel',
            message: `YouTube clip saved at ${formatTimestamp(response.timestamp)}!`
          });
        }
      } else {
        console.error('Not a valid YouTube video page or missing data');
        throw new Error('Not a valid YouTube video page');
      }
    } catch (error: any) {
      console.error('Failed to save YouTube clip:', error);
      if (chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon48.png'),
          title: 'Squirrel',
          message: error.message.includes('refresh') 
            ? error.message 
            : 'Failed to save YouTube clip. Try refreshing the page.'
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
  } catch (error: any) {
    // Log detailed error information
    console.error('Error saving note:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      fullError: error
    });
    throw error;
  }
}

// Save YouTube clip with transcript
async function saveYouTubeClip(clip: {
  videoId: string;
  timestamp: number;
  title: string;
  channel: string;
  thumbnail: string;
  transcript: string;
}): Promise<void> {
  try {
    const storage = await StorageFactory.getStorage();
    const aiService = await AIFactory.getAIService();

    // Build timestamped URL
    const videoUrl = `https://www.youtube.com/watch?v=${clip.videoId}&t=${clip.timestamp}s`;
    
    // Create content: transcript or title if no transcript
    const content = clip.transcript 
      ? `${clip.title}\n\n${clip.transcript}`
      : clip.title;

    // For transcript, get a context window around the timestamp (if available)
    const contextContent = clip.transcript || content;

    // Generate embedding and tags
    const [embedding, tags] = await Promise.all([
      aiService.generateEmbedding(contextContent),
      aiService.generateTags(contextContent)
    ]);

    // Add 'youtube' tag
    if (!tags.includes('youtube')) {
      tags.push('youtube');
    }

    // Save to storage with video metadata
    await storage.saveNote({
      content,
      embedding,
      tags,
      source: {
        url: videoUrl,
        title: `${clip.title} [${formatTimestamp(clip.timestamp)}]`,
        timestamp: Date.now(),
        videoId: clip.videoId,
        videoTimestamp: clip.timestamp,
        channel: clip.channel,
        thumbnail: clip.thumbnail,
        type: 'youtube'
      }
    });
  } catch (error: any) {
    console.error('Error saving YouTube clip:', {
      message: error?.message,
      fullError: error
    });
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

    // Check if the question is asking about a specific type of content
    const questionLower = question.toLowerCase();
    const isYouTubeQuery = questionLower.includes('youtube') || questionLower.includes('video');
    
    let relevantNotes: any[] = [];

    if (isYouTubeQuery) {
      // Get all notes and filter for YouTube videos
      console.log('YouTube-specific query detected, filtering for youtube tag');
      const allNotes = await storage.getAllNotes();
      relevantNotes = allNotes
        .filter(note => note.tags.includes('youtube') || note.source?.type === 'youtube')
        .slice(0, 10); // Limit to 10 most recent YouTube videos
      
      console.log('Found', relevantNotes.length, 'YouTube videos');
    } else {
      // Use vector search for general queries
      const queryEmbedding = await aiService.generateEmbedding(question);
      console.log('Query embedding generated, dimensions:', queryEmbedding.length);
      
      relevantNotes = await storage.searchByVector(queryEmbedding, 5);
      console.log('Vector search returned', relevantNotes.length, 'notes');

      // If no results from vector search, try getting recent notes as fallback
      if (relevantNotes.length === 0) {
        console.log('No vector matches, falling back to recent notes');
        const recentNotes = await storage.getRecentNotes(5);
        relevantNotes.push(...recentNotes);
      }
    }

    // Combine note contents as context with better formatting
    const context = relevantNotes
      .map((note, index) => {
        const isVideo = note.tags.includes('youtube') || note.source?.type === 'youtube';
        
        if (isVideo) {
          // For YouTube videos, extract title and provide video context
          const lines = note.content.split('\n');
          const title = lines[0] || 'Unknown video';
          const description = lines.slice(1).join(' ').substring(0, 200);
          
          return `${index + 1}. YouTube Video: "${title}"
   - Topic tags: ${note.tags.filter(t => t !== 'youtube').join(', ') || 'general'}
   - Description: ${description || 'No description available'}
   - URL: ${note.source?.url || 'N/A'}`;
        } else {
          // For regular notes
          return `${index + 1}. Note about: ${note.tags.slice(0, 3).join(', ')}
   - Content: ${note.content.substring(0, 250)}...
   - Source: ${note.source?.title || 'Unknown'}`;
        }
      })
      .join('\n\n');

    console.log('Context length:', context.length, 'chars');
    console.log('Context preview:', context.substring(0, 500));

    // Generate answer
    const answer = await aiService.answerQuestion(question, context);

    return {
      answer,
      sources: relevantNotes.map(note => ({
        id: note.id,
        content: note.content.substring(0, 200),
        tags: note.tags,
        isYouTube: note.tags.includes('youtube') || note.source?.type === 'youtube',
        url: note.source?.url
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

