# ⚡ Aether - Smart Template Extension

A Chrome extension for instant text template insertion with fuzzy search.

[![CI](https://github.com/Reliccode/aether-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/Reliccode/aether-extension/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/tag/Reliccode/aether-extension?label=release)](https://github.com/Reliccode/aether-extension/releases)
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

### Development (monorepo)

```bash
# Install dependencies (uses pnpm workspaces)
pnpm install

# Start dev server with HMR (extension)
pnpm --filter @aether/extension dev

# Build for production
pnpm --filter @aether/extension build
```

See `docs/testing.md` for lint/unit/E2E commands and CI label rules.
To seed the local knowledge cache quickly during dev: `pnpm --filter @aether/extension dev:load-pack`.

### Load in Chrome

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` folder

## 📁 Project Structure (monorepo)

```
apps/
  extension/          # Aether Edge (Chrome extension)
    src/
      background/
      content/        # overlay, slash menu, adapters
      options/
    tests/            # unit + e2e (Playwright)
packages/
  (reserved for shared libs: core, contracts, ui-kit)
docs/                 # testing guide, etc.
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
