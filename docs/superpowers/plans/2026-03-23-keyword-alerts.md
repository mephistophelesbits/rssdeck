# Keyword Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a keyword appears as a whole word in an article title, highlight the title in the keyword's chosen color and show a badge pill identifying which keyword matched.

**Architecture:** Add a `KeywordAlert` type to `lib/types.ts`, extend the Zustand settings store and server-side `PersistedSettings` to persist the alert list, update `ArticleCard` to match titles and apply the highlight, and add a "Keyword Alerts" management tab to `SettingsModal`. No new files, no DB schema changes — alerts are stored in the existing `app_settings` JSON blob.

**Tech Stack:** React 19, Next.js 15, TypeScript, Zustand, Tailwind CSS, nanoid (already in node_modules).

**Reference spec:** `docs/superpowers/specs/2026-03-23-keyword-alerts-design.md`

---

## File Map

| Action | File | What changes |
|--------|------|--------------|
| Modify | `lib/types.ts` | Add `KeywordAlert` export interface |
| Modify | `lib/settings-store.ts` | Add `keywordAlerts` to 4 places + `setKeywordAlerts` action |
| Modify | `lib/server/settings-repository.ts` | Add `keywordAlerts` to `PersistedSettings` |
| Modify | `lib/i18n/en.json` | Add `settings.keywordAlerts.*` keys |
| Modify | `lib/i18n/zh-CN.json` | Add `settings.keywordAlerts.*` Chinese translations |
| Modify | `components/deck/ArticleCard.tsx` | Match title, render colored title + badge |
| Modify | `components/ui/SettingsModal.tsx` | Add keyword alerts tab |

---

## Task 1: Add `KeywordAlert` type and extend settings data model

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/settings-store.ts`
- Modify: `lib/server/settings-repository.ts`

- [ ] **Step 1: Add `KeywordAlert` interface to `lib/types.ts`**

  Add after the last interface in the file (after `DeckStateSnapshot`):

  ```ts
  export interface KeywordAlert {
    id: string;       // nanoid — stable React key, survives keyword edits
    keyword: string;  // stored as entered; matching is case-insensitive
    color: string;    // hex color string, e.g. "#ff4444"
    enabled: boolean; // false = skip during matching but keep in list
  }
  ```

- [ ] **Step 2: Import `KeywordAlert` and extend `SettingsState` in `lib/settings-store.ts`**

  At the top of the file, add the import:
  ```ts
  import type { KeywordAlert } from '@/lib/types';
  ```

  In the `SettingsState` interface (after `setBriefingSettings` and before `hydrateSettings`), add:
  ```ts
  keywordAlerts: KeywordAlert[];
  setKeywordAlerts: (alerts: KeywordAlert[]) => void;
  ```

- [ ] **Step 3: Add `keywordAlerts` to `SettingsSnapshot`, `getDefaultSettingsSnapshot`, and `toSettingsSnapshot`**

  In `SettingsSnapshot` (the `Pick<>` type around line 94), add `'keywordAlerts'` to the union:
  ```ts
  export type SettingsSnapshot = Pick<
    SettingsState,
    | 'themeId'
    | 'defaultRefreshInterval'
    | 'defaultViewMode'
    | 'showPreviewPanel'
    | 'articleAgeFilter'
    | 'locale'
    | 'aiSettings'
    | 'briefingSettings'
    | 'keywordAlerts'
  >;
  ```

  In `getDefaultSettingsSnapshot()` (around line 106), add `keywordAlerts: []` after `briefingSettings`:
  ```ts
  keywordAlerts: [],
  ```

  In `toSettingsSnapshot(state)` (around line 135), add after `briefingSettings`:
  ```ts
  keywordAlerts: state.keywordAlerts,
  ```

- [ ] **Step 4: Add `setKeywordAlerts` action to the store**

  In the `create<SettingsState>()((set) => ({...}))` block (around line 160), add after `setBriefingSettings`:

  ```ts
  setKeywordAlerts: (alerts) =>
    set((state) => {
      const keywordAlerts = alerts;
      persistSettings(toSettingsSnapshot({ ...state, keywordAlerts }));
      return { keywordAlerts };
    }),
  ```

  Also add `keywordAlerts: []` to the initial state spread (the `...getDefaultSettingsSnapshot()` line already handles this since we updated the function above — verify it appears there).

- [ ] **Step 5: Add `keywordAlerts` to `PersistedSettings` in `lib/server/settings-repository.ts`**

  Import `KeywordAlert` at the top:
  ```ts
  import type { KeywordAlert } from '@/lib/types';
  ```

  In the `PersistedSettings` type (after `briefingSettings`), add:
  ```ts
  keywordAlerts: KeywordAlert[];
  ```

- [ ] **Step 6: Verify TypeScript compiles**

  ```bash
  npm run build
  ```

  Expected: no type errors. If you see errors about `keywordAlerts` not existing in `SettingsSnapshot` or `PersistedSettings`, double-check Steps 3 and 5.

- [ ] **Step 7: Commit**

  ```bash
  git add lib/types.ts lib/settings-store.ts lib/server/settings-repository.ts
  git commit -m "feat: add KeywordAlert type and extend settings data model"
  ```

---

## Task 2: Add i18n translation keys

**Files:**
- Modify: `lib/i18n/en.json`
- Modify: `lib/i18n/zh-CN.json`

- [ ] **Step 1: Add English keys to `lib/i18n/en.json`**

  The `"settings"` object already exists. Add a `"keywordAlerts"` sub-object inside it, after the last existing key in `"settings"` (find the closing `}` of the `"settings"` object and add before it):

  ```json
  "keywordAlerts": {
    "tab": "Keyword Alerts",
    "description": "Highlight article titles that contain these keywords.",
    "placeholder": "Keyword (e.g. bitcoin)",
    "add": "Add",
    "empty": "No keyword alerts yet."
  }
  ```

- [ ] **Step 2: Add Chinese keys to `lib/i18n/zh-CN.json`**

  Add the same structure with Chinese translations inside the `"settings"` object:

  ```json
  "keywordAlerts": {
    "tab": "关键词提醒",
    "description": "当文章标题包含这些关键词时高亮显示。",
    "placeholder": "关键词（如 bitcoin）",
    "add": "添加",
    "empty": "暂无关键词提醒。"
  }
  ```

- [ ] **Step 3: Verify build still passes**

  ```bash
  npm run build
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add lib/i18n/en.json lib/i18n/zh-CN.json
  git commit -m "feat: add i18n keys for keyword alerts"
  ```

---

## Task 3: Highlight matched titles in `ArticleCard`

**Files:**
- Modify: `components/deck/ArticleCard.tsx`

- [ ] **Step 1: Destructure `keywordAlerts` from the settings store**

  In `ArticleCard.tsx`, the store is already imported and `aiSettings` is already destructured at line 25:
  ```ts
  const { aiSettings } = useSettingsStore();
  ```

  Change this line to also pull `keywordAlerts`:
  ```ts
  const { aiSettings, keywordAlerts } = useSettingsStore();
  ```

- [ ] **Step 2: Add matching logic after the existing `const bookmarked` line**

  After line 24 (`const bookmarked = isBookmarked(article.id);`), add:

  ```ts
  const matchedAlert = keywordAlerts
    .filter(a => a.enabled)
    .find(a => {
      const escaped = a.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i').test(article.title);
    });
  ```

- [ ] **Step 3: Update the `<h3>` title element**

  The current `<h3>` at lines 109–116 is:
  ```tsx
  <h3
    className={cn(
      'font-medium text-foreground group-hover:text-accent transition-colors line-clamp-2 pr-6',
      viewMode === 'compact' ? 'text-sm' : 'text-base'
    )}
  >
    {decodeHtml(article.title)}
  </h3>
  ```

  Replace it with (move `text-foreground group-hover:text-accent` into the conditional):
  ```tsx
  <h3
    className={cn(
      'font-medium transition-colors line-clamp-2 pr-6',
      !matchedAlert && 'text-foreground group-hover:text-accent',
      viewMode === 'compact' ? 'text-sm' : 'text-base'
    )}
    style={matchedAlert ? { color: matchedAlert.color } : undefined}
  >
    {decodeHtml(article.title)}
  </h3>
  ```

- [ ] **Step 4: Add the badge pill as a sibling of `<h3>`**

  The `<h3>` sits inside `<div className="flex items-start gap-2">` at line 107. Add the badge immediately after the closing `</h3>` tag, still inside that flex div:

  ```tsx
  {matchedAlert && (
    <span
      style={{
        background: matchedAlert.color + '22',
        color: matchedAlert.color,
        border: `1px solid ${matchedAlert.color}55`,
      }}
      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5"
    >
      {matchedAlert.keyword}
    </span>
  )}
  ```

- [ ] **Step 5: Verify TypeScript compiles**

  ```bash
  npm run build
  ```

  Expected: no type errors. `matchedAlert` will be `KeywordAlert | undefined` — TypeScript will confirm the `style` conditional is correct.

- [ ] **Step 6: Manual smoke test**

  ```bash
  npm run dev
  ```

  Open http://localhost:3001. In Settings → Keyword Alerts (not built yet, but you can test by temporarily adding a hardcoded alert to the store's default state). Set a keyword that matches a visible article title. Confirm the title changes color and the badge appears.

  Restore the default state after testing.

- [ ] **Step 7: Commit**

  ```bash
  git add components/deck/ArticleCard.tsx
  git commit -m "feat: highlight article titles matching keyword alerts"
  ```

---

## Task 4: Add Keyword Alerts tab to SettingsModal

**Files:**
- Modify: `components/ui/SettingsModal.tsx`

- [ ] **Step 1: Add `nanoid` import and `setKeywordAlerts` destructure**

  At the top of `SettingsModal.tsx`, add after the existing imports:
  ```ts
  import { nanoid } from 'nanoid';
  ```

  In the `useSettingsStore()` destructure (around line 17), add `keywordAlerts` and `setKeywordAlerts`:
  ```ts
  const {
    themeId,
    defaultRefreshInterval,
    defaultViewMode,
    setTheme,
    setDefaultRefreshInterval,
    setDefaultViewMode,
    aiSettings,
    setAiSettings,
    keywordAlerts,
    setKeywordAlerts,
  } = useSettingsStore();
  ```

- [ ] **Step 2: Add local state for the add-row inputs**

  After the existing `useState` declarations (around line 39), add:
  ```ts
  const [newKeyword, setNewKeyword] = useState('');
  const [newColor, setNewColor] = useState('#ff4444');
  ```

- [ ] **Step 3: Widen `activeTab` union type**

  Change line 41 from:
  ```ts
  const [activeTab, setActiveTab] = useState<'general' | 'ai'>('general');
  ```
  To:
  ```ts
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'keyword-alerts'>('general');
  ```

- [ ] **Step 4: Add tab button after the AI tab button**

  The AI tab button ends around line 170. After the closing `</button>` of the AI tab, add:

  ```tsx
  <button
    onClick={() => setActiveTab('keyword-alerts')}
    className={cn(
      "pb-2 transition-colors relative",
      activeTab === 'keyword-alerts' ? "text-foreground font-medium" : "text-foreground-secondary hover:text-foreground"
    )}
  >
    {t('settings.keywordAlerts.tab')}
    {activeTab === 'keyword-alerts' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-t-full" />}
  </button>
  ```

- [ ] **Step 5: Add tab content panel**

  After the `{activeTab === 'ai' && (...)}` block (which ends around line 450+), add:

  ```tsx
  {activeTab === 'keyword-alerts' && (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
      <p className="text-sm text-foreground-secondary">
        {t('settings.keywordAlerts.description')}
      </p>

      {/* Add new alert */}
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newKeyword.trim()) {
              setKeywordAlerts([...keywordAlerts, { id: nanoid(), keyword: newKeyword.trim(), color: newColor, enabled: true }]);
              setNewKeyword('');
            }
          }}
          placeholder={t('settings.keywordAlerts.placeholder')}
          className="flex-1 bg-background-secondary border border-border rounded px-3 py-1.5 text-sm text-foreground placeholder:text-foreground-secondary focus:outline-none focus:border-accent"
        />
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
          title="Choose alert color"
        />
        <button
          onClick={() => {
            if (!newKeyword.trim()) return;
            setKeywordAlerts([...keywordAlerts, { id: nanoid(), keyword: newKeyword.trim(), color: newColor, enabled: true }]);
            setNewKeyword('');
          }}
          disabled={!newKeyword.trim()}
          className="px-3 py-1.5 text-sm bg-accent/20 text-accent border border-accent/30 rounded hover:bg-accent/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('settings.keywordAlerts.add')}
        </button>
      </div>

      {/* Alert list */}
      {keywordAlerts.length === 0 ? (
        <p className="text-sm text-foreground-secondary italic">{t('settings.keywordAlerts.empty')}</p>
      ) : (
        <div className="space-y-2">
          {keywordAlerts.map((alert) => (
            <div key={alert.id} className="flex items-center gap-2 bg-background-secondary border border-border rounded-lg px-3 py-2">
              {/* Color dot */}
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: alert.color }}
              />
              {/* Keyword */}
              <span className="flex-1 text-sm text-foreground">{alert.keyword}</span>
              {/* Enable toggle */}
              <button
                onClick={() => setKeywordAlerts(keywordAlerts.map(a => a.id === alert.id ? { ...a, enabled: !a.enabled } : a))}
                className={cn(
                  'w-9 h-5 rounded-full transition-colors relative flex-shrink-0',
                  alert.enabled ? 'bg-accent' : 'bg-border'
                )}
                title={alert.enabled ? 'Disable alert' : 'Enable alert'}
              >
                <div className={cn(
                  'w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform',
                  alert.enabled ? 'translate-x-4' : 'translate-x-0.5'
                )} />
              </button>
              {/* Color swatch */}
              <label className="w-7 h-7 rounded cursor-pointer flex-shrink-0 border border-border overflow-hidden" title="Change color">
                <input
                  type="color"
                  value={alert.color}
                  onChange={(e) => setKeywordAlerts(keywordAlerts.map(a => a.id === alert.id ? { ...a, color: e.target.value } : a))}
                  className="w-full h-full opacity-0 absolute"
                />
                <div className="w-full h-full" style={{ background: alert.color }} />
              </label>
              {/* Delete */}
              <button
                onClick={() => setKeywordAlerts(keywordAlerts.filter(a => a.id !== alert.id))}
                className="text-foreground-secondary hover:text-foreground transition-colors flex-shrink-0 text-lg leading-none"
                title="Delete alert"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )}
  ```

- [ ] **Step 6: Verify TypeScript compiles**

  ```bash
  npm run build
  ```

  Expected: clean build with no type errors.

- [ ] **Step 7: Manual end-to-end test**

  ```bash
  npm run dev
  ```

  Open http://localhost:3001. Open Settings → Keyword Alerts tab.

  **Test A — Add alert:**
  - Type a keyword that appears in a visible article title (check the feed first)
  - Pick a bright color (e.g. red)
  - Click Add (or press Enter)
  - Close Settings — verify the matching article title is now red with a keyword badge

  **Test B — Disable alert:**
  - Toggle the alert off
  - Verify the article title returns to its normal color

  **Test C — Change color:**
  - Click the color swatch on the alert
  - Pick a different color
  - Verify the article title updates immediately

  **Test D — Delete alert:**
  - Click × on the alert
  - Verify it disappears from the list and the article title returns to normal

  **Test E — Persistence:**
  - Add an alert, close and reopen the browser
  - Verify the alert is still there

  **Test F — Regex-safe keywords:**
  - Add a keyword like `C++`
  - Verify no console errors and matching works correctly

- [ ] **Step 8: Commit**

  ```bash
  git add components/ui/SettingsModal.tsx
  git commit -m "feat: add keyword alerts management tab to settings modal"
  ```
