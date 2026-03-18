# Dark Theme Carbon + Emerald Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blue-tinted dark theme with a Carbon + Emerald palette — pure black/dark-grey backgrounds and emerald green accents.

**Architecture:** All theme tokens live in a single CSS file (`app/globals.css`) under the `.dark` class. Updating the token values there propagates every change automatically to all components via Tailwind CSS variables — no component files need touching.

**Tech Stack:** CSS custom properties, Tailwind CSS v4 (`@theme inline` mapping)

**Spec:** `docs/superpowers/specs/2026-03-18-dark-theme-carbon-emerald-design.md`

---

## Chunk 1: Update dark theme tokens and glass card shadow

### Task 1: Update `.dark` CSS token block

**Files:**
- Modify: `app/globals.css` lines 26–44

- [ ] **Step 1: Open `app/globals.css` and locate the `.dark` block (lines 26–44)**

Confirm the current values match:
```css
.dark {
  --background: #0a0c12;
  --background-secondary: #161b2a;
  --background-tertiary: rgba(22, 27, 42, 0.7);
  --foreground: #f1f5f9;
  --foreground-secondary: #94a3b8;
  --accent: #1152d4;
  --accent-hover: #1e5fe8;
  --accent-light: rgba(17, 82, 212, 0.2);
  --accent-foreground: #ffffff;
  --border: #2d3446;
  --success: #10b981;
  --error: #ef4444;
  --warning: #f59e0b;
}
```

- [ ] **Step 2: Replace the entire `.dark` block with the Carbon + Emerald tokens**

Replace with:
```css
/* Reader Studio - Dark Theme (Carbon + Emerald) */
.dark {
  --background: #0d0d0d; /* Pure black */
  --background-secondary: #141414; /* Dark grey surface */
  --background-tertiary: rgba(20, 20, 20, 0.7);

  --foreground: #f1f5f9; /* Slate 100 — unchanged */
  --foreground-secondary: #9ca3af; /* Neutral Grey 400 */

  --accent: #22c55e; /* Emerald 500 */
  --accent-hover: #16a34a; /* Emerald 600 */
  --accent-light: rgba(34, 197, 94, 0.15);
  --accent-foreground: #ffffff;

  --border: #262626; /* Neutral dark grey */

  --success: #22c55e; /* Unified with accent */
  --error: #ef4444;
  --warning: #f59e0b;
}
```

- [ ] **Step 3: Verify dark mode renders correctly in the browser**

Run the dev server if not already running:
```bash
npm run dev
```
Open `http://localhost:3000`. Toggle to dark mode.

Expected:
- App background is near-black with no blue cast
- Column surfaces are dark grey (`#141414`)
- Any accent-coloured elements (active states, buttons, links, badges) show emerald green
- Text is off-white / neutral grey — no blue tint
- Borders are neutral dark grey

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat: replace dark theme with Carbon + Emerald palette"
```

---

### Task 2: Update `.dark .glass-card` box-shadow

**Files:**
- Modify: `app/globals.css` lines 173–176

- [ ] **Step 1: Locate the `.dark .glass-card` rule**

Current value (lines 173–176):
```css
.dark .glass-card {
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: none;
}
```

- [ ] **Step 2: Add subtle emerald glow to `.dark .glass-card`**

Replace with:
```css
.dark .glass-card {
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 8px 32px 0 rgba(34, 197, 94, 0.04);
}
```

Note: The base `.glass-card` rule (line 170) has a blue box-shadow for light mode — leave it **untouched**.

- [ ] **Step 3: Verify in browser**

With dark mode active, glass card panels should have a very faint emerald glow instead of none. The effect is subtle by design (`0.04` opacity).

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat: add subtle emerald glass-card glow in dark mode"
```

---

### Task 3: Final visual check across the full UI

- [ ] **Step 1: Check all major UI surfaces in dark mode**

With dev server running at `http://localhost:3000`:

| Surface | Expected |
|---|---|
| Main background | `#0d0d0d` — pure black |
| Column headers / panels | `#141414` — dark grey |
| Dropdown / settings overlay | `rgba(20,20,20,0.7)` — neutral semi-transparent |
| Active column / selected state | Emerald green accent |
| Links / interactive elements | Emerald green |
| Borders | `#262626` — neutral dark grey, no blue |
| Scrollbars | Neutral white-rgba (unchanged) |
| Glass cards | Faint emerald glow |

- [ ] **Step 2: Verify light mode is untouched**

Toggle back to light mode. All colours should be identical to before — no regression.

- [ ] **Step 3: Push branch and open PR**

```bash
git push
```

Then open a PR targeting `main` with title: `feat: Carbon + Emerald dark theme`.
