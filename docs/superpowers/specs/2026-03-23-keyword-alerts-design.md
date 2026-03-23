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
| Alert is disabled (enabled: false) | Skipped during matching |
| Article has no title | No match attempted |

**Whole-word matching:** Uses `new RegExp(\`\\b${keyword}\\b\`, 'i')`. "bitcoin" matches "Bitcoin" and "BITCOIN" but not "bitcoins" or "probitcoin".

---

## Data Model

Added to `SettingsState` and `PersistedSettings` in `lib/settings-store.ts` and `lib/server/settings-repository.ts`:

```ts
keywordAlerts: Array<{
  id: string;       // nanoid — stable React key, survives keyword edits
  keyword: string;  // the word to watch for, stored as entered (matching is case-insensitive)
  color: string;    // hex color string, e.g. "#ff4444"
  enabled: boolean; // false = skip during matching, keep in list
}>
```

Default value: `[]` (empty array).

Persisted inside the existing `app_settings` JSON blob — no database schema changes required.

---

## File Map

| Action | File | What changes |
|--------|------|--------------|
| Modify | `lib/types.ts` | Add `KeywordAlert` export type |
| Modify | `lib/settings-store.ts` | Add `keywordAlerts` to `SettingsState`, `SettingsSnapshot`, default state, and `setKeywordAlerts` action |
| Modify | `lib/server/settings-repository.ts` | Add `keywordAlerts` to `PersistedSettings` type and default |
| Modify | `components/deck/ArticleCard.tsx` | Read `keywordAlerts` from store, match title, render colored title + badge |
| Modify | `components/ui/SettingsModal.tsx` | Add "Keyword Alerts" tab with add/edit/delete/toggle UI |

---

## Implementation Details

### `lib/types.ts`

```ts
export interface KeywordAlert {
  id: string;
  keyword: string;
  color: string;
  enabled: boolean;
}
```

### `lib/settings-store.ts`

```ts
// Added to SettingsState:
keywordAlerts: KeywordAlert[];
setKeywordAlerts: (alerts: KeywordAlert[]) => void;

// Default:
keywordAlerts: [],

// Action:
setKeywordAlerts: (alerts) => {
  set({ keywordAlerts: alerts });
  persistSettings(get());
},
```

### `components/deck/ArticleCard.tsx` — matching logic

```ts
const { keywordAlerts } = useSettingsStore();

const matchedAlert = keywordAlerts
  .filter(a => a.enabled)
  .find(a => new RegExp(`\\b${a.keyword}\\b`, 'i').test(article.title));
```

**Title rendering (conditional style):**
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

**Badge pill (rendered when matched, inside the title flex container):**
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

New tab added after "Briefing":

- **Add row:** text input for keyword + `<input type="color">` native color picker + "Add" button. On submit, appends a new `KeywordAlert` with `nanoid()` id and `enabled: true`.
- **Alert list:** each row shows colored dot, keyword text, enable toggle, color swatch (`<input type="color">`), delete (×) button.
- **Enable toggle:** clicking flips `enabled` on that alert.
- **Color swatch:** wraps a hidden `<input type="color">` — clicking the swatch opens the native color picker.
- **Delete:** removes the alert from the array.
- All changes call `setKeywordAlerts(updatedAlerts)` which persists immediately.

---

## Out of Scope

- Matching against content snippet or full article body (title only).
- Sound or push notifications on keyword match.
- Per-column alert configuration (alerts apply globally across all columns).
- Regex or wildcard keyword patterns.
