// Content script for capturing text selection and YouTube clips
console.log('AI Notes content script loaded');

// Detect if we're on YouTube
function isYouTubePage(): boolean {
  return window.location.hostname === 'www.youtube.com' || window.location.hostname === 'youtube.com';
}

// Get YouTube video ID from URL
function getYouTubeVideoId(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');
}

// Get current video timestamp
function getYouTubeTimestamp(): number {
  const video = document.querySelector('video') as HTMLVideoElement;
  return video ? Math.floor(video.currentTime) : 0;
}

// Format timestamp as HH:MM:SS or MM:SS
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Fetch YouTube transcript using YouTube's API (auto-captions)
async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  try {
    // First, try to get the transcript from the page's initial data
    const scripts = document.querySelectorAll('script');
    let captionsUrl: string | null = null;
    
    for (const script of scripts) {
      const content = script.textContent || '';
      if (content.includes('captionTracks')) {
        // Extract caption tracks
        const match = content.match(/"captionTracks":\s*(\[.*?\])/);
        if (match) {
          try {
            const tracks = JSON.parse(match[1]);
            // Prefer English captions
            const englishTrack = tracks.find((t: any) => t.languageCode === 'en') || tracks[0];
            if (englishTrack && englishTrack.baseUrl) {
              captionsUrl = englishTrack.baseUrl;
              break;
            }
          } catch (e) {
            console.error('Failed to parse caption tracks:', e);
          }
        }
      }
    }
    
    if (!captionsUrl) {
      console.log('No captions available for this video');
      return '';
    }
    
    // Fetch and parse the transcript
    const response = await fetch(captionsUrl);
    const xmlText = await response.text();
    
    // Parse XML and extract text
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const textElements = xmlDoc.querySelectorAll('text');
    
    const transcript = Array.from(textElements)
      .map(el => el.textContent || '')
      .map(text => text.replace(/&amp;#39;/g, "'").replace(/&amp;quot;/g, '"').replace(/&amp;/g, '&'))
      .join(' ')
      .trim();
    
    return transcript;
  } catch (error) {
    console.error('Failed to fetch transcript:', error);
    return '';
  }
}

// Get YouTube video metadata
function getYouTubeMetadata(): { title: string; channel: string; thumbnail: string } {
  const title = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent?.trim() 
    || document.querySelector('yt-formatted-string.ytd-watch-metadata')?.textContent?.trim()
    || document.title;
  
  const channel = document.querySelector('ytd-channel-name a')?.textContent?.trim() 
    || document.querySelector('yt-formatted-string.ytd-channel-name a')?.textContent?.trim()
    || 'Unknown Channel';
  
  const videoId = getYouTubeVideoId();
  const thumbnail = videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : '';
  
  return { title, channel, thumbnail };
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelection') {
    const selection = window.getSelection();
    const selectedText = selection?.toString() || '';
    
    sendResponse({
      text: selectedText,
      url: window.location.href,
      title: document.title
    });
  }
  
  if (request.action === 'getYouTubeInfo') {
    const videoId = getYouTubeVideoId();
    const timestamp = getYouTubeTimestamp();
    const metadata = getYouTubeMetadata();
    
    sendResponse({
      videoId,
      timestamp,
      ...metadata,
      isYouTube: isYouTubePage()
    });
  }
  
  if (request.action === 'fetchTranscript') {
    const videoId = getYouTubeVideoId();
    if (videoId) {
      fetchYouTubeTranscript(videoId).then(transcript => {
        sendResponse({ transcript });
      }).catch(error => {
        sendResponse({ transcript: '', error: error.message });
      });
      return true; // Keep channel open for async response
    } else {
      sendResponse({ transcript: '', error: 'No video ID found' });
    }
  }
  
  return true;
});

// Add keyboard shortcut support (Ctrl/Cmd + Shift + S to save selection)
document.addEventListener('keydown', async (event) => {
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'S') {
    event.preventDefault();
    
    const selection = window.getSelection();
    const selectedText = selection?.toString()?.trim();
    
    if (selectedText) {
      try {
        // Send to background script
        await chrome.runtime.sendMessage({
          action: 'saveNote',
          data: {
            content: selectedText,
            url: window.location.href,
            title: document.title
          }
        });
        
        // Visual feedback
        showSaveConfirmation();
      } catch (error) {
        console.error('Failed to save note:', error);
      }
    }
  }
});

// Show a temporary confirmation message
function showSaveConfirmation() {
  const notification = document.createElement('div');
  notification.textContent = '✓ Saved to AI Notes';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// Add animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

