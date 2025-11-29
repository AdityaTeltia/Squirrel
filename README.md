# Squirrel 🐿️

> Hoard knowledge like a squirrel hoards nuts

AI-powered Chrome extension that helps you save, organize, and search through web content with the enthusiasm of a squirrel preparing for winter. Because let's face it, we all hoard information anyway.

<img width="1199" height="718" alt="image" src="https://github.com/user-attachments/assets/89f65f90-c6c4-41d6-9ad2-b8e05fd8fc2f" />


## Features

- **One-Click Save**: Right-click selected text → "Save to AI Notes"
- **AI Auto-Tagging**: Automatic tag generation (removes stopwords & punctuation)
- **Smart Search**: Find notes by keywords or content
- **AI Chat**: Ask questions about your saved notes
- **Multiple AI Providers**: Chrome AI (local), OpenAI, or Google Gemini
- **Storage Options**: Local (IndexedDB) or Cloud (Supabase with pgvector)
- **Clean UI**: Modern interface with system theme support (light/dark)

## Quick Start

### Prerequisites
- [Bun](https://bun.sh/) - Fast JavaScript runtime
- Chrome/Edge browser

### Installation

```bash
# Clone and install
git clone https://github.com/yourusername/squirrel.git
cd squirrel
bun install

# Build
bun run build

# Load extension
1. Open chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder
```

## Configuration

Click the extension icon → Settings to configure:

### AI Provider (Default: Chrome AI)
- **Chrome AI**: Free, private, offline. [Setup required](#chrome-ai-setup)
- **OpenAI**: Most powerful. Needs API key from [platform.openai.com](https://platform.openai.com/api-keys)
- **Gemini**: Fast and free tier. Get key from [ai.google.dev](https://ai.google.dev/)

### Storage (Default: Local)
- **Local (IndexedDB)**: Fast, private, stored on disk at `~/Library/Application Support/Google/Chrome/Default/IndexedDB/`
- **Cloud (Supabase)**: Sync across devices. [Setup guide](#supabase-setup)

**Note**: API keys are stored in Chrome's encrypted sync storage (local + synced to your Google account if signed in).

## Chrome AI Setup

1. Install [Chrome Canary](https://www.google.com/chrome/canary/) or Chrome Dev
2. Enable flags:
   - `chrome://flags/#optimization-guide-on-device-model` → Enabled
   - `chrome://flags/#prompt-api-for-gemini-nano` → Enabled
3. Restart Chrome
4. AI model downloads automatically (~2GB, one-time)

## Supabase Setup

<details>
<summary>Click to expand</summary>

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Run this SQL in SQL Editor:

```sql
-- Enable pgvector extension
create extension if not exists vector;

-- Create notes table
-- Using 1536 dimensions (works with all AI providers via auto-padding)
create table notes (
  id uuid primary key default uuid_generate_v4(),
  content text not null,
  embedding vector(1536),
  tags text[] not null default '{}',
  source jsonb not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create index for vector similarity search
create index notes_embedding_idx on notes 
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Create index for tags
create index notes_tags_idx on notes using gin(tags);

-- Create function for vector similarity search
create or replace function match_notes(
  query_embedding vector(1536),
  match_threshold float default 0.3,
  match_count int default 10
)
returns table (
  id uuid,
  content text,
  embedding vector(1536),
  tags text[],
  source jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
)
language sql stable
as $$
  select
    notes.id,
    notes.content,
    notes.embedding,
    notes.tags,
    notes.source,
    notes.created_at,
    notes.updated_at,
    1 - (notes.embedding <=> query_embedding) as similarity
  from notes
  where 1 - (notes.embedding <=> query_embedding) > match_threshold
  order by notes.embedding <=> query_embedding
  limit match_count;
$$;
```

**✨ Works with ALL AI providers!** The extension automatically pads embeddings:
- Gemini (768) → padded to 1536
- Chrome AI (384-768) → padded to 1536  
- OpenAI (1536) → used as-is

**If you already created the table with wrong dimensions:**

4. Copy project URL and anon key to Settings

</details>

## Usage

1. **Save Notes**: Select text on any webpage → Right-click → "Save to AI Notes"
2. **Search Notes**: Click extension icon → Search tab → Enter keywords
3. **AI Chat**: Click extension icon → AI Chat tab → Ask "What did I save about X?"
4. **Recent Notes**: Click extension icon → Recent tab → View last 5 notes

## Development

```bash
# Development mode (watch + rebuild)
bun run dev

# Production build
bun run build

# Clean build artifacts
bun run clean
```

**Build Warning**: The service worker bundle size warning (~940KB) is expected due to AI libraries.

## Project Structure

```
src/
├── ai/              # AI service implementations
├── storage/         # Storage backends (IndexedDB, Supabase)
├── background/      # Service worker
├── content/         # Content script
├── ui/              # Popup, search page, settings
└── utils/           # Utilities (vector, tags, etc.)
```

## Next Steps

### Planned Features
1. **YouTube Clip Saver** 🎥
   - Save video clips with timestamp links
   - Automatic speech-to-text transcription
   - Search transcripts and jump to exact moments
   - *Because squirrels hoard more than just text*

2. **Improved AI** 🧠
   - Better embeddings (fine-tuned models)
   - Advanced tokenization
   - Context-aware search ranking
   - Multi-language support
   - *Smarter nut detection*

### Contributing
Issues and PRs welcome! Help make this the best digital hoarding tool out there. 🐿️

## Technical Details

- **Framework**: TypeScript + Webpack
- **Storage**: Dexie.js (IndexedDB wrapper), Supabase (PostgreSQL + pgvector)
- **AI**: Chrome AI APIs, OpenAI SDK, Google Generative AI SDK
- **UI**: Vanilla CSS with CSS variables for theming

## License

MIT

## Acknowledgments

Built with modern web APIs and AI capabilities. Inspired by the need for intelligent, private note-taking.

---

**Star ⭐ this repo if you find it useful!**
