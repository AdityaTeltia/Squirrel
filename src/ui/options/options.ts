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
      toggleConfigSection('supabaseConfig', value === 'supabase');
      toggleConfigSection('supabaseKeyConfig', value === 'supabase');
    });
  });

  // AI provider radio buttons
  document.querySelectorAll('input[name="ai"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value;
      toggleConfigSection('openaiConfig', value === 'openai');
      toggleConfigSection('geminiConfig', value === 'gemini');
    });
  });

  // Save button
  document.getElementById('saveBtn')?.addEventListener('click', saveConfig);

  // Reset button
  document.getElementById('resetBtn')?.addEventListener('click', resetConfig);

  // Delete all button
  document.getElementById('deleteAllBtn')?.addEventListener('click', deleteAllNotes);
}

function toggleConfigSection(sectionId: string, show: boolean) {
  const section = document.getElementById(sectionId);
  if (section) {
    section.style.display = show ? 'block' : 'none';
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
      toggleConfigSection('supabaseConfig', config.storageBackend === 'supabase');
      toggleConfigSection('supabaseKeyConfig', config.storageBackend === 'supabase');
    }

    // Set AI provider
    const aiRadio = document.querySelector(
      `input[name="ai"][value="${config.aiProvider}"]`
    ) as HTMLInputElement;
    if (aiRadio) {
      aiRadio.checked = true;
      toggleConfigSection('openaiConfig', config.aiProvider === 'openai');
      toggleConfigSection('geminiConfig', config.aiProvider === 'gemini');
    }

    // Set API keys and URLs
    if (config.supabaseUrl) {
      (document.getElementById('supabaseUrl') as HTMLInputElement).value = config.supabaseUrl;
    }
    if (config.supabaseKey) {
      (document.getElementById('supabaseKey') as HTMLInputElement).value = config.supabaseKey;
    }
    if (config.openaiKey) {
      (document.getElementById('openaiKey') as HTMLInputElement).value = config.openaiKey;
    }
    if (config.geminiKey) {
      (document.getElementById('geminiKey') as HTMLInputElement).value = config.geminiKey;
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
      const supabaseUrl = (document.getElementById('supabaseUrl') as HTMLInputElement).value.trim();
      const supabaseKey = (document.getElementById('supabaseKey') as HTMLInputElement).value.trim();

      if (!supabaseUrl || !supabaseKey) {
        showStatus('Please provide both Supabase URL and API key', 'error');
        return;
      }

      config.supabaseUrl = supabaseUrl;
      config.supabaseKey = supabaseKey;
    }

    // Get OpenAI API key if selected
    if (aiProvider === 'openai') {
      const openaiKey = (document.getElementById('openaiKey') as HTMLInputElement).value.trim();
      
      if (!openaiKey) {
        showStatus('Please provide OpenAI API key', 'error');
        return;
      }

      config.openaiKey = openaiKey;
    }

    // Get Gemini API key if selected
    if (aiProvider === 'gemini') {
      const geminiKey = (document.getElementById('geminiKey') as HTMLInputElement).value.trim();
      
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
    (document.querySelector('input[name="storage"][value="indexdb"]') as HTMLInputElement).checked = true;
    (document.querySelector('input[name="ai"][value="chrome"]') as HTMLInputElement).checked = true;
    
    (document.getElementById('supabaseUrl') as HTMLInputElement).value = '';
    (document.getElementById('supabaseKey') as HTMLInputElement).value = '';
    (document.getElementById('openaiKey') as HTMLInputElement).value = '';
    (document.getElementById('geminiKey') as HTMLInputElement).value = '';

    toggleConfigSection('supabaseConfig', false);
    toggleConfigSection('supabaseKeyConfig', false);
    toggleConfigSection('openaiConfig', false);
    toggleConfigSection('geminiConfig', false);

    showStatus('Settings reset to defaults', 'success');
  } catch (error) {
    console.error('Failed to reset config:', error);
    showStatus('Failed to reset settings', 'error');
  }
}

async function deleteAllNotes() {
  if (!confirm('Delete ALL notes? This action cannot be undone!')) {
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

  // Hide after 3 seconds
  setTimeout(() => {
    status.classList.remove('show');
  }, 3000);
}

