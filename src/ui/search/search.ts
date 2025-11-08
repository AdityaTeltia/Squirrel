// Search page logic

let selectedNoteId: string | null = null;
let chatHistory: Array<{ role: 'user' | 'ai'; content: string; sources?: any[] }> = [];

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadRecentNotes();
});

function setupEventListeners() {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab) switchTab(tab);
    });
  });

  // Search functionality
  const searchInput = document.getElementById('searchInput') as HTMLInputElement;
  const searchBtn = document.getElementById('searchBtn') as HTMLButtonElement;

  searchBtn.addEventListener('click', () => performSearch(searchInput.value));
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch(searchInput.value);
  });

  // Chat functionality
  const chatInput = document.getElementById('chatInput') as HTMLTextAreaElement;
  const chatSendBtn = document.getElementById('chatSendBtn') as HTMLButtonElement;

  chatSendBtn.addEventListener('click', () => sendChatMessage(chatInput.value));
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage(chatInput.value);
    }
  });

  // AI question functionality (for individual notes)
  const questionInput = document.getElementById('questionInput') as HTMLInputElement;
  const askBtn = document.getElementById('askBtn') as HTMLButtonElement;

  askBtn.addEventListener('click', () => askQuestion(questionInput.value));
  questionInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') askQuestion(questionInput.value);
  });

  // Close detail view
  document.getElementById('closeDetailBtn')?.addEventListener('click', () => {
    showEmptyState();
  });

  // Delete note
  document.getElementById('deleteNoteBtn')?.addEventListener('click', async () => {
    if (selectedNoteId && confirm('Delete this note?')) {
      try {
        await chrome.runtime.sendMessage({
          action: 'deleteNote',
          data: { id: selectedNoteId }
        });
        showEmptyState();
        // Refresh current view
        const activeTab = document.querySelector('.tab-btn.active')?.getAttribute('data-tab');
        if (activeTab === 'search') {
          const searchInput = document.getElementById('searchInput') as HTMLInputElement;
          if (searchInput.value) performSearch(searchInput.value);
        } else if (activeTab === 'recent') {
          loadRecentNotes();
        }
      } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to delete note');
      }
    }
  });
}

function switchTab(tabName: string) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
  });

  // Update tab contents
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}Tab`);
  });

  // Load data if needed
  if (tabName === 'recent') {
    loadRecentNotes();
  }
}

async function performSearch(query: string) {
  if (!query.trim()) return;

  const resultsContainer = document.getElementById('searchResults');
  if (!resultsContainer) return;

  resultsContainer.innerHTML = '<div class="loading">Searching...</div>';

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
    resultsContainer.innerHTML = '<div class="empty">No notes found</div>';
    return;
  }

  resultsContainer.innerHTML = notes
    .map(note => createNoteItem(note))
    .join('');

  // Add click listeners
  resultsContainer.querySelectorAll('.note-item').forEach((el, idx) => {
    el.addEventListener('click', () => showNoteDetail(notes[idx]));
  });
}

async function loadRecentNotes() {
  const recentContainer = document.getElementById('recentNotes');
  if (!recentContainer) return;

  recentContainer.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getRecentNotes',
      data: { limit: 5 }
    });

    if (response.notes.length === 0) {
      recentContainer.innerHTML = '<div class="empty">No notes yet</div>';
      return;
    }

    recentContainer.innerHTML = response.notes
      .map((note: any) => createNoteItem(note))
      .join('');

    // Add click listeners
    recentContainer.querySelectorAll('.note-item').forEach((el, idx) => {
      el.addEventListener('click', () => showNoteDetail(response.notes[idx]));
    });
  } catch (error) {
    console.error('Load recent notes error:', error);
    recentContainer.innerHTML = '<div class="empty">Failed to load notes</div>';
  }
}

function createNoteItem(note: any): string {
  const date = new Date(note.createdAt).toLocaleDateString();
  const tags = note.tags
    .map((tag: string) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join('');

  return `
    <div class="note-item" data-id="${note.id}">
      <div class="note-content">${escapeHtml(truncate(note.content, 100))}</div>
      ${tags ? `<div class="note-tags">${tags}</div>` : ''}
      <div class="note-meta">${date}</div>
    </div>
  `;
}

async function sendChatMessage(message: string) {
  if (!message.trim()) return;

  const chatInput = document.getElementById('chatInput') as HTMLTextAreaElement;
  const chatContainer = document.getElementById('chatContainer') as HTMLDivElement;

  // Clear input
  chatInput.value = '';

  // Remove welcome message if present
  const welcome = chatContainer.querySelector('.chat-welcome');
  if (welcome) {
    welcome.remove();
  }

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
  const messageId = `msg-${Date.now()}`;

  const avatarText = role === 'user' ? 'U' : 'AI';
  
  const sourcesHtml = sources && sources.length > 0 ? `
    <div class="chat-sources">
      <div class="chat-sources-title">Sources (${sources.length}):</div>
      ${sources.map((source: any) => `
        <div class="chat-source-item" title="${escapeHtml(source.content)}">
          ${escapeHtml(truncate(source.content, 60))}
        </div>
      `).join('')}
    </div>
  ` : '';

  const messageHtml = `
    <div class="chat-message ${role}" id="${messageId}">
      <div class="chat-avatar ${role}">${avatarText}</div>
      <div class="chat-bubble ${role}">
        ${escapeHtml(content)}
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

  // Hide empty state, show detail view
  const emptyView = document.getElementById('emptyView');
  const detailView = document.getElementById('detailView');
  const answerSection = document.getElementById('answerSection');

  if (emptyView) emptyView.style.display = 'none';
  if (detailView) detailView.style.display = 'flex';
  if (answerSection) answerSection.classList.remove('show');

  // Populate note details
  const noteContent = document.getElementById('noteContent');
  const noteTags = document.getElementById('noteTags');
  const noteUrl = document.getElementById('noteUrl') as HTMLAnchorElement;
  const noteTimestamp = document.getElementById('noteTimestamp');

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

  // Clear question input
  const questionInput = document.getElementById('questionInput') as HTMLInputElement;
  if (questionInput) questionInput.value = '';
}

function showEmptyState() {
  selectedNoteId = null;
  const emptyView = document.getElementById('emptyView');
  const detailView = document.getElementById('detailView');

  if (emptyView) emptyView.style.display = 'flex';
  if (detailView) detailView.style.display = 'none';
}

async function askQuestion(question: string) {
  if (!question.trim() || !selectedNoteId) return;

  const answerSection = document.getElementById('answerSection');
  const answerText = document.getElementById('answerText');

  if (!answerSection || !answerText) return;

  answerSection.classList.add('show');
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

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
