// Search page logic

let selectedNoteId: string | null = null;
let chatHistory: Array<{ role: 'user' | 'ai'; content: string; sources?: any[] }> = [];
let currentMode: 'search' | 'chat' | 'recent' = 'search';

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadRecentNotes();
});

function setupEventListeners() {
  // Mode switching
  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.getAttribute('data-mode') as 'search' | 'chat' | 'recent';
      if (mode) switchMode(mode);
    });
  });

  // Search functionality
  const searchInput = document.getElementById('searchInput') as HTMLInputElement;
  const searchBtn = document.getElementById('searchBtn') as HTMLButtonElement;

  if (searchInput && searchBtn) {
    searchBtn.addEventListener('click', () => performSearch(searchInput.value));
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') performSearch(searchInput.value);
    });
  }

  // Chat functionality
  const chatInput = document.getElementById('chatInput') as HTMLTextAreaElement;
  const chatSendBtn = document.getElementById('chatSendBtn') as HTMLButtonElement;

  if (chatInput && chatSendBtn) {
    chatSendBtn.addEventListener('click', () => sendChatMessage(chatInput.value));
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage(chatInput.value);
      }
    });
    // Auto-resize textarea
    chatInput.addEventListener('input', () => {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    });
  }

  // Note detail modal
  const closeDetailBtn = document.getElementById('closeDetailBtn');
  if (closeDetailBtn) {
    closeDetailBtn.addEventListener('click', closeNoteDetail);
  }

  const deleteNoteBtn = document.getElementById('deleteNoteBtn');
  if (deleteNoteBtn) {
    deleteNoteBtn.addEventListener('click', async () => {
      if (selectedNoteId && confirm('Delete this note?')) {
        await deleteNote(selectedNoteId);
        closeNoteDetail();
        // Refresh current view
        if (currentMode === 'search') {
          const searchInput = document.getElementById('searchInput') as HTMLInputElement;
          if (searchInput?.value) performSearch(searchInput.value);
        } else if (currentMode === 'recent') {
          loadRecentNotes();
        }
      }
    });
  }

  // Ask question about note
  const askBtn = document.getElementById('askBtn');
  const questionInput = document.getElementById('questionInput') as HTMLInputElement;
  if (askBtn && questionInput) {
    askBtn.addEventListener('click', () => askQuestion(questionInput.value));
    questionInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') askQuestion(questionInput.value);
    });
  }

  // Settings button
  const openOptionsBtn = document.getElementById('openOptions');
  if (openOptionsBtn) {
    openOptionsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
}

function switchMode(mode: 'search' | 'chat' | 'recent') {
  currentMode = mode;

  // Update tabs
  document.querySelectorAll('.mode-tab').forEach(tab => {
    const isActive = tab.getAttribute('data-mode') === mode;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive.toString());
  });

  // Update mode panels
  document.querySelectorAll('.mode-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  const activePanel = document.getElementById(`${mode}Mode`);
  if (activePanel) activePanel.classList.add('active');

  // Update results visibility
  const searchResults = document.getElementById('searchResults');
  const chatContainer = document.getElementById('chatContainer');
  const recentNotes = document.getElementById('recentNotes');

  if (searchResults) searchResults.style.display = mode === 'search' ? 'grid' : 'none';
  if (chatContainer) chatContainer.style.display = mode === 'chat' ? 'flex' : 'none';
  if (recentNotes) recentNotes.style.display = mode === 'recent' ? 'grid' : 'none';

  // Focus appropriate input
  if (mode === 'search') {
    const searchInput = document.getElementById('searchInput') as HTMLInputElement;
    if (searchInput) searchInput.focus();
  } else if (mode === 'chat') {
    const chatInput = document.getElementById('chatInput') as HTMLTextAreaElement;
    if (chatInput) chatInput.focus();
  }
}

async function performSearch(query: string) {
  if (!query.trim()) return;

  const resultsContainer = document.getElementById('searchResults');
  if (!resultsContainer) return;

  resultsContainer.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Searching...</p></div>';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'searchNotes',
      data: { query }
    });

    displaySearchResults(response.notes);
  } catch (error) {
    console.error('Search error:', error);
    resultsContainer.innerHTML = '<div class="empty">Search failed. Please try again.</div>';
  }
}

function displaySearchResults(notes: any[]) {
  const resultsContainer = document.getElementById('searchResults');
  if (!resultsContainer) return;

  if (notes.length === 0) {
    resultsContainer.innerHTML = '<div class="empty">No notes found matching your search.</div>';
    return;
  }

  resultsContainer.innerHTML = notes
    .map(note => createNoteCard(note))
    .join('');

  // Add click listeners
  resultsContainer.querySelectorAll('.note-card').forEach((el, idx) => {
    el.addEventListener('click', () => showNoteDetail(notes[idx]));
  });
}

async function loadRecentNotes() {
  const recentContainer = document.getElementById('recentNotes');
  if (!recentContainer) return;

  recentContainer.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading recent notes...</p></div>';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getRecentNotes',
      data: { limit: 12 }
    });

    if (response.notes.length === 0) {
      recentContainer.innerHTML = '<div class="empty">No notes yet. Start saving content from any webpage!</div>';
      return;
    }

    recentContainer.innerHTML = response.notes
      .map((note: any) => createNoteCard(note))
      .join('');

    // Add click listeners
    recentContainer.querySelectorAll('.note-card').forEach((el, idx) => {
      el.addEventListener('click', () => showNoteDetail(response.notes[idx]));
    });
  } catch (error) {
    console.error('Load recent notes error:', error);
    recentContainer.innerHTML = '<div class="empty">Failed to load notes</div>';
  }
}

function createNoteCard(note: any): string {
  const date = new Date(note.createdAt).toLocaleDateString();
  const tags = note.tags
    .map((tag: string) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join('');

  const isYouTube = note.source.type === 'youtube';
  
  // For YouTube videos, show thumbnail and play icon
  const videoPreview = isYouTube ? `
    <div class="video-preview">
      <img src="${note.source.thumbnail}" alt="Video thumbnail" class="video-thumbnail">
      <div class="play-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="white">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </div>
      <div class="video-badge">YouTube</div>
    </div>
  ` : '';
  
  const content = isYouTube 
    ? note.content.split('\n\n')[0] // Just show title for YouTube
    : escapeHtml(truncate(note.content, 150));

  return `
    <a href="${note.source.url}" target="_blank" class="note-card ${isYouTube ? 'video-card' : ''}" data-id="${note.id}" onclick="event.preventDefault(); showNoteDetail('${note.id}');">
      ${videoPreview}
      <div class="note-content">${content}</div>
      ${tags ? `<div class="note-tags">${tags}</div>` : ''}
      <div class="note-meta">${date} • ${escapeHtml(truncate(note.source.title, 40))}</div>
    </a>
  `;
}

async function sendChatMessage(message: string) {
  if (!message.trim()) return;

  const chatInput = document.getElementById('chatInput') as HTMLTextAreaElement;
  const chatContainer = document.getElementById('chatContainer') as HTMLDivElement;

  if (!chatInput || !chatContainer) return;

  // Clear input
  chatInput.value = '';
  chatInput.style.height = 'auto';

  // Add user message
  chatHistory.push({ role: 'user', content: message });
  appendChatMessage('user', message);

  // Show loading
  const loadingId = appendChatMessage('ai', 'Thinking...');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'askQuestion',
      data: { question: message }
    });

    // Remove loading message
    document.getElementById(loadingId)?.remove();

    // Add AI response
    chatHistory.push({ 
      role: 'ai', 
      content: response.answer,
      sources: response.sources 
    });
    appendChatMessage('ai', response.answer, response.sources);

  } catch (error) {
    console.error('Chat error:', error);
    document.getElementById(loadingId)?.remove();
    appendChatMessage('ai', 'Sorry, I encountered an error. Please try again.');
  }
}

function appendChatMessage(role: 'user' | 'ai', content: string, sources?: any[]): string {
  const chatContainer = document.getElementById('chatContainer') as HTMLDivElement;
  if (!chatContainer) return '';

  const messageId = `msg-${Date.now()}`;
  const avatarText = role === 'user' ? 'U' : 'AI';
  
  const sourcesHtml = sources && sources.length > 0 ? `
    <div class="chat-sources">
      <div class="chat-sources-title">Sources (${sources.length}):</div>
      ${sources.map((source: any) => {
        const isYouTube = source.isYouTube || source.tags?.includes('youtube');
        const badge = isYouTube ? '<span class="youtube-badge-mini">▶ YouTube</span>' : '';
        const link = source.url ? `<a href="${source.url}" target="_blank" class="source-link">Open</a>` : '';
        
        return `
          <div class="chat-source-item" title="${escapeHtml(source.content)}">
            <div class="source-header">
              ${badge}
              ${link}
            </div>
            <div class="source-content">${escapeHtml(truncate(source.content, 80))}</div>
            ${source.tags ? `<div class="source-tags">${source.tags.slice(0, 3).map((tag: string) => `<span class="tag-mini">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  ` : '';

  const messageHtml = `
    <div class="chat-message ${role}" id="${messageId}">
      <div class="chat-avatar ${role}">${avatarText}</div>
      <div class="chat-bubble ${role}">
        ${role === 'ai' ? formatAIResponse(content) : escapeHtml(content)}
        ${sourcesHtml}
      </div>
    </div>
  `;

  chatContainer.insertAdjacentHTML('beforeend', messageHtml);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  return messageId;
}

function showNoteDetail(note: any) {
  selectedNoteId = note.id;

  const modal = document.getElementById('noteDetail');
  const noteContent = document.getElementById('noteContent');
  const noteTags = document.getElementById('noteTags');
  const noteUrl = document.getElementById('noteUrl') as HTMLAnchorElement;
  const noteTimestamp = document.getElementById('noteTimestamp');
  const answerSection = document.getElementById('answerSection');
  const questionInput = document.getElementById('questionInput') as HTMLInputElement;

  if (!modal) return;

  // Populate content
  if (noteContent) noteContent.textContent = note.content;
  
  if (noteTags) {
    noteTags.innerHTML = note.tags
      .map((tag: string) => `<span class="tag">${escapeHtml(tag)}</span>`)
      .join('');
  }

  if (noteUrl) {
    noteUrl.href = note.source.url;
    noteUrl.textContent = note.source.title || note.source.url;
  }

  if (noteTimestamp) {
    noteTimestamp.textContent = new Date(note.createdAt).toLocaleString();
  }

  if (answerSection) answerSection.style.display = 'none';
  if (questionInput) questionInput.value = '';

  // Show modal
  modal.style.display = 'block';
}

function closeNoteDetail() {
  const modal = document.getElementById('noteDetail');
  if (modal) modal.style.display = 'none';
  selectedNoteId = null;
}

async function askQuestion(question: string) {
  if (!question.trim() || !selectedNoteId) return;

  const answerSection = document.getElementById('answerSection');
  const answerText = document.getElementById('answerText');

  if (!answerSection || !answerText) return;

  answerSection.style.display = 'block';
  answerText.textContent = 'Thinking...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'askQuestion',
      data: { question }
    });

    answerText.textContent = response.answer;
  } catch (error) {
    console.error('Question error:', error);
    answerText.textContent = 'Failed to get answer. Please try again.';
  }
}

async function deleteNote(id: string) {
  try {
    await chrome.runtime.sendMessage({
      action: 'deleteNote',
      data: { id }
    });
  } catch (error) {
    console.error('Delete error:', error);
  }
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatAIResponse(text: string): string {
  // Escape HTML first for safety
  const escaped = escapeHtml(text);
  
  // Split into paragraphs (double line breaks or single line breaks followed by bullets/numbers)
  const paragraphs = escaped.split(/\n\n+/);
  
  // Process each paragraph
  const formatted = paragraphs.map(para => {
    // Convert **bold** to <strong>
    let processed = para.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Convert *italic* to <em>
    processed = processed.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
    
    // Handle single line breaks within paragraphs
    processed = processed.replace(/\n/g, '<br>');
    
    // Wrap in paragraph tag
    return `<p>${processed}</p>`;
  }).join('');
  
  return formatted;
}
