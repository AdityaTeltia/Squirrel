// Options page logic

interface Config {
  storageBackend: 'indexdb' | 'supabase';
  aiProvider: 'chrome' | 'openai' | 'gemini';
  supabaseUrl?: string;
  supabaseKey?: string;
  openaiKey?: string;
  geminiKey?: string;
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  setupEventListeners();
});

function setupEventListeners() {
  // Storage radio buttons
  document.querySelectorAll('input[name="storage"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value;
      toggleConfigPanel('supabaseConfig', value === 'supabase');
    });
  });

  // AI provider radio buttons
  document.querySelectorAll('input[name="ai"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value;
      toggleConfigPanel('openaiConfig', value === 'openai');
      toggleConfigPanel('geminiConfig', value === 'gemini');
    });
  });

  // Save button
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveConfig);
  }

  // Reset button
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetConfig);
  }

  // Delete all button
  const deleteAllBtn = document.getElementById('deleteAllBtn');
  if (deleteAllBtn) {
    deleteAllBtn.addEventListener('click', deleteAllNotes);
  }
}

function toggleConfigPanel(panelId: string, show: boolean) {
  const panel = document.getElementById(panelId);
  if (panel) {
    panel.style.display = show ? 'block' : 'none';
  }
}

async function loadConfig() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
    const config: Config = response.config || {
      storageBackend: 'indexdb',
      aiProvider: 'chrome'
    };

    // Set storage backend
    const storageRadio = document.querySelector(
      `input[name="storage"][value="${config.storageBackend}"]`
    ) as HTMLInputElement;
    if (storageRadio) {
      storageRadio.checked = true;
      toggleConfigPanel('supabaseConfig', config.storageBackend === 'supabase');
    }

    // Set AI provider
    const aiRadio = document.querySelector(
      `input[name="ai"][value="${config.aiProvider}"]`
    ) as HTMLInputElement;
    if (aiRadio) {
      aiRadio.checked = true;
      toggleConfigPanel('openaiConfig', config.aiProvider === 'openai');
      toggleConfigPanel('geminiConfig', config.aiProvider === 'gemini');
    }

    // Set API keys and URLs
    if (config.supabaseUrl) {
      const supabaseUrl = document.getElementById('supabaseUrl') as HTMLInputElement;
      if (supabaseUrl) supabaseUrl.value = config.supabaseUrl;
    }
    if (config.supabaseKey) {
      const supabaseKey = document.getElementById('supabaseKey') as HTMLInputElement;
      if (supabaseKey) supabaseKey.value = config.supabaseKey;
    }
    if (config.openaiKey) {
      const openaiKey = document.getElementById('openaiKey') as HTMLInputElement;
      if (openaiKey) openaiKey.value = config.openaiKey;
    }
    if (config.geminiKey) {
      const geminiKey = document.getElementById('geminiKey') as HTMLInputElement;
      if (geminiKey) geminiKey.value = config.geminiKey;
    }
  } catch (error) {
    console.error('Failed to load config:', error);
    showStatus('Failed to load settings', 'error');
  }
}

async function saveConfig() {
  try {
    const storageBackend = (document.querySelector('input[name="storage"]:checked') as HTMLInputElement)?.value as 'indexdb' | 'supabase';
    const aiProvider = (document.querySelector('input[name="ai"]:checked') as HTMLInputElement)?.value as 'chrome' | 'openai' | 'gemini';

    const config: Config = {
      storageBackend,
      aiProvider
    };

    // Get Supabase credentials if selected
    if (storageBackend === 'supabase') {
      const supabaseUrlInput = document.getElementById('supabaseUrl') as HTMLInputElement;
      const supabaseKeyInput = document.getElementById('supabaseKey') as HTMLInputElement;
      
      const supabaseUrl = supabaseUrlInput?.value.trim();
      const supabaseKey = supabaseKeyInput?.value.trim();

      if (!supabaseUrl || !supabaseKey) {
        showStatus('Please provide both Supabase URL and API key', 'error');
        return;
      }

      config.supabaseUrl = supabaseUrl;
      config.supabaseKey = supabaseKey;
    }

    // Get OpenAI API key if selected
    if (aiProvider === 'openai') {
      const openaiKeyInput = document.getElementById('openaiKey') as HTMLInputElement;
      const openaiKey = openaiKeyInput?.value.trim();
      
      if (!openaiKey) {
        showStatus('Please provide OpenAI API key', 'error');
        return;
      }

      config.openaiKey = openaiKey;
    }

    // Get Gemini API key if selected
    if (aiProvider === 'gemini') {
      const geminiKeyInput = document.getElementById('geminiKey') as HTMLInputElement;
      const geminiKey = geminiKeyInput?.value.trim();
      
      if (!geminiKey) {
        showStatus('Please provide Gemini API key', 'error');
        return;
      }

      config.geminiKey = geminiKey;
    }

    // Save to storage
    await chrome.runtime.sendMessage({
      action: 'setConfig',
      data: { config }
    });

    showStatus('Settings saved successfully!', 'success');
  } catch (error) {
    console.error('Failed to save config:', error);
    showStatus('Failed to save settings', 'error');
  }
}

async function resetConfig() {
  if (!confirm('Reset all settings to defaults? This will not delete your notes.')) {
    return;
  }

  try {
    const defaultConfig: Config = {
      storageBackend: 'indexdb',
      aiProvider: 'chrome'
    };

    await chrome.runtime.sendMessage({
      action: 'setConfig',
      data: { config: defaultConfig }
    });

    // Clear form
    const indexdbRadio = document.querySelector('input[name="storage"][value="indexdb"]') as HTMLInputElement;
    const chromeRadio = document.querySelector('input[name="ai"][value="chrome"]') as HTMLInputElement;
    
    if (indexdbRadio) indexdbRadio.checked = true;
    if (chromeRadio) chromeRadio.checked = true;
    
    // Clear inputs
    const inputs = ['supabaseUrl', 'supabaseKey', 'openaiKey', 'geminiKey'];
    inputs.forEach(id => {
      const input = document.getElementById(id) as HTMLInputElement;
      if (input) input.value = '';
    });

    // Hide config panels
    toggleConfigPanel('supabaseConfig', false);
    toggleConfigPanel('openaiConfig', false);
    toggleConfigPanel('geminiConfig', false);

    showStatus('Settings reset to defaults', 'success');
  } catch (error) {
    console.error('Failed to reset config:', error);
    showStatus('Failed to reset settings', 'error');
  }
}

async function deleteAllNotes() {
  if (!confirm('⚠️ Delete ALL notes?\n\nThis action cannot be undone!')) {
    return;
  }

  if (!confirm('Are you absolutely sure? All your notes will be permanently deleted.')) {
    return;
  }

  try {
    await chrome.runtime.sendMessage({ action: 'deleteAllNotes' });
    showStatus('All notes deleted successfully', 'success');
  } catch (error) {
    console.error('Failed to delete notes:', error);
    showStatus('Failed to delete notes', 'error');
  }
}

function showStatus(message: string, type: 'success' | 'error') {
  const status = document.getElementById('status');
  if (!status) return;

  status.textContent = message;
  status.className = `status ${type} show`;

  // Hide after 4 seconds
  setTimeout(() => {
    status.classList.remove('show');
  }, 4000);
}
