# Keyword Alerts — Design Spec

**Date:** 2026-03-23
**Status:** Approved
**Scope:** Allow users to define keyword alerts. When a keyword appears as a whole word in an article title, the title is highlighted in the keyword's chosen color and a badge pill identifies which keyword matched.

---

## Overview

Users configure a list of keyword alerts in the Settings modal. Each alert has a keyword and a color. When any article card renders, it checks the title against all enabled alerts. On a match, the title text changes to the alert color and a small pill badge appears next to the title showing the matched keyword.

---

## Behaviour

| Condition | Result |
|-----------|--------|
| No alerts configured | No change to article rendering |
| Article title contains alert keyword (whole word, case-insensitive) | Title turns alert color; badge pill appears |
| Multiple alerts match the same title | First enabled alert in list order wins |
| Alert is disabled (`enabled: false`) | Skipped during matching |
| Keyword contains regex special characters (e.g. `C++`, `$TSLA`) | Characters are escaped before building the RegExp — no runtime error |
| Keyword input is empty | "Add" button is disabled; no alert is created |
| Duplicate keywords | Allowed; first enabled match in list order wins (user controls ordering by delete/re-add) |

**Whole-word matching:** Uses `new RegExp(\`\\b${escaped}\\b\`, 'i')` where `escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`. Matches "Bitcoin" and "BITCOIN" but not "bitcoins" or "probitcoin".

---

## Data Model

The following fields are added in four places in `lib/settings-store.ts`:

1. **`SettingsState` interface** — add `keywordAlerts: KeywordAlert[]` and `setKeywordAlerts: (alerts: KeywordAlert[]) => void`
2. **`SettingsSnapshot` Pick** — add `'keywordAlerts'` to the union
3. **`getDefaultSettingsSnapshot()`** — add `keywordAlerts: []`
4. **`toSettingsSnapshot(state)`** — add `keywordAlerts: state.keywordAlerts`

The `KeywordAlert` type (defined in `lib/types.ts`):

```ts
export interface KeywordAlert {
  id: string;       // nanoid — stable React key, survives keyword edits
  keyword: string;  // stored as entered; matching is case-insensitive
  color: string;    // hex color string, e.g. "#ff4444"
  enabled: boolean; // false = skip during matching but keep in list
}
```

Also add `keywordAlerts: KeywordAlert[]` to `PersistedSettings` in `lib/server/settings-repository.ts`. The defaults for `getPersistedSettings` come from `getDefaultSettingsSnapshot()` (called in `app/api/settings/route.ts`) — adding `keywordAlerts: []` there covers the server-side defaults as well. No separate change needed in the API route.

Persisted inside the existing `app_settings` JSON blob — no database schema changes required.

---

## File Map

| Action | File | What changes |
|--------|------|--------------|
| Modify | `lib/types.ts` | Add `KeywordAlert` export interface |
| Modify | `lib/settings-store.ts` | Add `keywordAlerts` to `SettingsState`, `SettingsSnapshot`, `getDefaultSettingsSnapshot`, `toSettingsSnapshot`; add `setKeywordAlerts` action |
| Modify | `lib/server/settings-repository.ts` | Add `keywordAlerts: KeywordAlert[]` to `PersistedSettings` type and its default |
| Modify | `components/deck/ArticleCard.tsx` | Read `keywordAlerts` from store, match title, render colored title + badge |
| Modify | `components/ui/SettingsModal.tsx` | Add `'keyword-alerts'` to `activeTab` union; add "Keyword Alerts" tab after the "AI" tab |
| Modify | `lib/i18n/en.json` + `lib/i18n/zh-CN.json` | Add translation keys for new UI strings |

---

## Implementation Details

### `lib/settings-store.ts` — `setKeywordAlerts` action

Follows the exact pattern used by all other actions in the store (uses `set((state) => ...)` with `toSettingsSnapshot`):

```ts
setKeywordAlerts: (alerts) =>
  set((state) => {
    const keywordAlerts = alerts;
    persistSettings(toSettingsSnapshot({ ...state, keywordAlerts }));
    return { keywordAlerts };
  }),
```

The store creator signature `(set) =>` does not need to change — this pattern does not require `get`.

### `components/deck/ArticleCard.tsx` — matching logic

```ts
const { keywordAlerts } = useSettingsStore();

const matchedAlert = keywordAlerts
  .filter(a => a.enabled)
  .find(a => {
    const escaped = a.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(article.title);
  });
```

**Title rendering** — the existing unconditional `text-foreground group-hover:text-accent` classes on `<h3>` must move into the `!matchedAlert &&` conditional branch. When matched, those classes are omitted and an inline `style` supplies the color instead:

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

**Badge pill** — rendered as a **sibling** of `<h3>` inside the existing `<div className="flex items-start gap-2">` container at line 107, not as a child of `<h3>`:

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

### `components/ui/SettingsModal.tsx` — Keyword Alerts tab

**`activeTab` type** — widen the union at line 41:

```ts
const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'keyword-alerts'>('general');
```

**Import** — add `import { nanoid } from 'nanoid';` at the top of `SettingsModal.tsx`. The package is already in `node_modules` as a transitive dependency.

**New tab button** — add after the existing "AI" tab button in the tab bar.

**Tab content** — rendered when `activeTab === 'keyword-alerts'`:

- **Description line:** `t('settings.keywordAlerts.description')` (e.g. "Highlight article titles that contain these keywords.")
- **Add row:** text input (`placeholder={t('settings.keywordAlerts.placeholder')}`) + `<input type="color">` (default `#ff4444`) + Add button (`t('settings.keywordAlerts.add')`). Add button is **disabled** when the keyword input is empty. On submit: append `{ id: nanoid(), keyword: trimmed input, color: selected color, enabled: true }` then call `setKeywordAlerts(updated)`.
- **Alert list:** each row: colored dot · keyword text · enable toggle · color swatch (`<input type="color">` wrapped in a styled div) · delete (×) button. Toggling, changing color, or deleting calls `setKeywordAlerts(updated)` immediately.

### i18n keys to add to `en.json` and `zh-CN.json`

```json
"settings": {
  "keywordAlerts": {
    "tab": "Keyword Alerts",
    "description": "Highlight article titles that contain these keywords.",
    "placeholder": "Keyword (e.g. bitcoin)",
    "add": "Add",
    "empty": "No keyword alerts yet."
  }
}
```

Chinese translations (`zh-CN.json`): use appropriate Chinese equivalents.

---

## Out of Scope

- Matching against content snippet or full article body (title only).
- Sound or push notifications on keyword match.
- Per-column alert configuration (alerts apply globally across all columns).
- Regex or wildcard keyword patterns (keywords are treated as literal strings).
- Reordering alerts (delete and re-add to reorder).
