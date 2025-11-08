// Popup UI logic
document.addEventListener('DOMContentLoaded', async () => {
  // Load recent notes
  loadRecentNotes();
  
  // Load tags
  loadTags();

  // Setup event listeners
  setupEventListeners();
});

function setupEventListeners() {
  // Search functionality
  const searchInput = document.getElementById('searchInput') as HTMLInputElement;
  const searchBtn = document.getElementById('searchBtn') as HTMLButtonElement;

  searchBtn.addEventListener('click', () => performSearch(searchInput.value));
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch(searchInput.value);
  });

  // Tab switching
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      switchTab(tabName!);
    });
  });

  // Open full search page
  document.getElementById('openFullSearch')?.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('ui/search/search.html') });
  });

  // Open search in side panel
  document.getElementById('openSearch')?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      chrome.sidePanel.open({ tabId: tab.id });
    }
  });

  // Open options
  document.getElementById('openOptions')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

function switchTab(tabName: string) {
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}Tab`);
  });
}

async function performSearch(query: string) {
  if (!query.trim()) return;

  const notesContainer = document.getElementById('recentNotes');
  if (!notesContainer) return;

  notesContainer.innerHTML = '<div class="loading">Searching...</div>';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'searchNotes',
      data: { query }
    });

    displayNotes(response.notes);
  } catch (error) {
    console.error('Search error:', error);
    notesContainer.innerHTML = '<div class="empty">Search failed. Please try again.</div>';
  }
}

async function loadRecentNotes() {
  const notesContainer = document.getElementById('recentNotes');
  if (!notesContainer) return;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getRecentNotes',
      data: { limit: 10 }
    });

    displayNotes(response.notes);
  } catch (error) {
    console.error('Error loading notes:', error);
    notesContainer.innerHTML = '<div class="empty">Failed to load notes</div>';
  }
}

function displayNotes(notes: any[]) {
  const notesContainer = document.getElementById('recentNotes');
  if (!notesContainer) return;

  if (notes.length === 0) {
    notesContainer.innerHTML = '<div class="empty">No notes yet. Start saving by selecting text on any webpage!</div>';
    return;
  }

  notesContainer.innerHTML = notes.map(note => createNoteCard(note)).join('');

  // Add delete button listeners
  notesContainer.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const noteId = (e.target as HTMLElement).getAttribute('data-id');
      if (noteId && confirm('Delete this note?')) {
        await deleteNote(noteId);
        loadRecentNotes();
      }
    });
  });
}

function createNoteCard(note: any): string {
  const date = new Date(note.createdAt).toLocaleDateString();
  const tags = note.tags.map((tag: string) => `<span class="tag">${tag}</span>`).join('');
  
  return `
    <div class="note-card">
      <button class="delete-btn" data-id="${note.id}">Delete</button>
      <div class="note-content">${escapeHtml(note.content)}</div>
      <div class="note-tags">${tags}</div>
      <div class="note-meta">
        <span>${date}</span>
        <span>${note.source.title.substring(0, 30)}...</span>
      </div>
    </div>
  `;
}

async function deleteNote(id: string) {
  try {
    await chrome.runtime.sendMessage({
      action: 'deleteNote',
      data: { id }
    });
  } catch (error) {
    console.error('Error deleting note:', error);
  }
}

async function loadTags() {
  const tagsContainer = document.getElementById('tagsList');
  if (!tagsContainer) return;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getTags'
    });

    if (response.tags.length === 0) {
      tagsContainer.innerHTML = '<div class="empty">No tags yet</div>';
      return;
    }

    tagsContainer.innerHTML = response.tags
      .map((tag: string) => `<div class="tag-item">${tag}</div>`)
      .join('');

    // Add click listeners to tags
    tagsContainer.querySelectorAll('.tag-item').forEach(tagEl => {
      tagEl.addEventListener('click', () => {
        const searchInput = document.getElementById('searchInput') as HTMLInputElement;
        searchInput.value = tagEl.textContent || '';
        switchTab('recent');
        performSearch(tagEl.textContent || '');
      });
    });
  } catch (error) {
    console.error('Error loading tags:', error);
    tagsContainer.innerHTML = '<div class="empty">Failed to load tags</div>';
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
