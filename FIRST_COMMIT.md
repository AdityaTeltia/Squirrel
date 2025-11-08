# Squirrel 🐿️ - First Commit

This is the initial release of Squirrel, an AI-powered Chrome extension that helps you hoard knowledge like a squirrel hoards nuts.

## What's Included

### Core Features
- Right-click to save selected text from any webpage
- AI-powered automatic tagging (with stopword/punctuation removal)
- Keyword search through saved notes
- AI chat interface to query notes with natural language
- Recent notes view (last 5)
- Clean, modern UI with system theme support (light/dark)

### AI Providers
- Chrome AI (built-in, offline, free)
- OpenAI (GPT-4 + embeddings)
- Google Gemini (2.5-flash)

### Storage Options
- Local: IndexedDB (Dexie.js)
- Cloud: Supabase with pgvector for semantic search

### UI Components
- Extension popup (quick search + recent notes)
- Side panel (full search page with tabs)
- Settings page (configure AI provider & storage)
- Notifications on save

## Tech Stack
- TypeScript
- Webpack 5
- Chrome Extension Manifest V3
- Dexie.js for IndexedDB
- Supabase client
- OpenAI SDK
- Google Generative AI SDK
- Bun as package manager

## Project Structure
```
src/
├── ai/              # AI service implementations
├── storage/         # Storage backends
├── background/      # Service worker
├── content/         # Content scripts
├── ui/              # User interfaces
│   ├── popup/       # Extension popup
│   ├── search/      # Full search page
│   └── options/     # Settings page
└── utils/           # Utilities (vectors, tags, config)
```

## Next Steps
See README.md for planned features including:
- YouTube clip saving with STT
- Enhanced UI/UX improvements
- Better embeddings and tokenization

## Known Issues
- Service worker bundle size warning (expected due to AI libraries)
- Chrome AI requires Chrome Canary with flags enabled

---

This project is ready for community feedback and contributions!

