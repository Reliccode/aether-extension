# ⚡ Aether - Smart Template Extension

A Chrome extension for instant text template insertion with fuzzy search.

![Aether](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![Chrome](https://img.shields.io/badge/Platform-Chrome%20Extension-blue)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue)
![React](https://img.shields.io/badge/UI-React%2018-61dafb)

## 🎯 Features

- **🔍 Fuzzy Search** - Type `/tag` anywhere to find templates instantly
- **⌨️ Keyboard-First** - Navigate with Arrow keys, Enter to insert, Escape to close
- **🌍 Multi-Language** - EN/DE toggle with TAB key (extensible)
- **📊 Usage Analytics** - Track which templates you use most
- **🎨 Shadow DOM** - Isolated styles, works on any website
- **💾 IndexedDB** - Persistent local storage

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Extension                      │
├─────────────────┬─────────────────┬─────────────────────┤
│   Content Script │    Background    │    Options Page    │
│   (Shadow DOM)   │  (Service Worker)│    (Dashboard)     │
├─────────────────┼─────────────────┼─────────────────────┤
│ SuggestionList  │    Fuse.js      │    Template CRUD   │
│ Input Adapters  │    IndexedDB    │    EN/DE Editor    │
└─────────────────┴─────────────────┴─────────────────────┘
```

## 🚀 Quick Start

### Development

```bash
# Install dependencies
npm install

# Start dev server with HMR
npm run dev

# Build for production
npm run build
```

### Load in Chrome

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` folder

## 📁 Project Structure

```
src/
├── background/         # Service worker
│   ├── index.ts       # Message handling, search
│   └── db.ts          # IndexedDB operations
├── content/           # Content script
│   ├── index.tsx      # Main injection logic
│   ├── adapters/      # Input field adapters
│   └── ui/            # SuggestionList component
├── options/           # Dashboard page
│   ├── App.tsx        # Template management UI
│   └── main.tsx       # Entry point
└── common/
    └── types.ts       # Shared TypeScript types
```

## 🛠️ Tech Stack

- **Build**: Vite + CRXJS
- **Language**: TypeScript
- **UI**: React 18 + Tailwind CSS
- **Search**: Fuse.js (fuzzy matching)
- **Storage**: IndexedDB via `idb`
- **Icons**: Lucide React

## 📝 Usage

1. **Click extension icon** → See most-used templates
2. **Type `/tag`** anywhere → Popup appears with matches
3. **Arrow keys** → Navigate options
4. **TAB** → Switch EN/DE language
5. **Enter** → Insert selected template
6. **Dashboard** → Create/edit/delete templates

## 📄 License

MIT License - feel free to use for personal or commercial projects.

---

Built with ⚡ by [Reliccode](https://github.com/Reliccode)
