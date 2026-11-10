# Find it fast: launcher home and one search

Date: 2026-11-10. Status: awaiting review. Stage 1 of 2 of the UI/UX work.

## 1. Purpose

This stage makes every drug and every tool reachable from one search, from any screen.

Today a pharmacist at a workstation picks the tool first, then searches inside it. The home page is a marketing banner with two buttons. Only the top menu reaches four of the six tools. The 12 calculators sit in one flat row.

**Success criteria**

1. From any screen, Cmd+K, a few letters and Enter open any drug's Mixing Guide card or any calculator. The keyboard alone does it.
2. The home page shows all six tools.
3. The Calculators page groups its 12 calculators and reopens on the one used last.
4. At 1024px wide, every top-menu label sits on one line and the page does not scroll sideways.
5. New UI uses no text smaller than 13px.
6. Clinical content and calculations do not change. The diff touches nothing in `data/` and no calculation function.

**Decisions the user made**

- Main use is a desktop at work.
- Priorities: reach tools faster, easier reading, one consistent look.
- Navigation: launcher home plus one search. The top menu stays.
- Enter on a drug opens its Mixing Guide card.
- Break Room gets a launcher card like the other five tools.

## 2. Scope

**In scope:** the home page, the search, the Calculators selector, the top menu at 1024px and wider.

**Out of scope:**

- The phone layout. Today the menu is 816px wide on a 375px screen. This stage leaves it.
- Text size and visual consistency inside the existing tools. That is Stage 2 (section 9).
- A sidebar, denser layouts, and any change to the Copilot password screen.

## 3. Home page

The launcher replaces the banner in the `home` block of `app/page.tsx`. It has three parts.

**Search box.** Placeholder: "Search any drug or calculator…", with a "⌘K" hint ("Ctrl K" off macOS). On a device with a mouse or trackpad, the box takes focus on load. On a touch device it does not, so the keyboard stays closed. Results appear in a list under the box. It is the same search panel as section 4.

**Six tool cards.** Three columns at 1024px and wider, two at 640px, one below. Each card has an icon, the tool's name and one line:

| Tool | Line |
|---|---|
| Switching Protocols | Find replacement therapies when a medication has to change. |
| Infusion Copilot | Ask any infusion question and get a cited answer. |
| Clinical Calculators | *N* dosing, rate and lab calculators. |
| Drug Reference | Compounding, stability and safety data for *N* drugs. |
| Mixing Guide | Mix, administer and store cards at a glance. |
| Break Room | Short games for a mental reset. |

Both *N* values come from the data (`CALCULATORS.length`, `DRUG_DB.length`).

**Recent row.** Up to five chips, newest first. When the list is empty, the page hides the row.

A drug chip shows the generic name and where it opened ("Vancomycin · Mixing Guide"). A calculator chip shows its label. Clicking a chip reopens that place.

## 4. Search

One panel, `SearchPanel`, holds the input, the result list and the keyboard handling. Two shells use it: the home page shows it inline, and `CommandPalette` shows it in a dialog.

**Opening.** Cmd+K or Ctrl+K opens the dialog from any screen, including when focus is in an input. Pressing it again closes the dialog. On the home page the shortcut focuses the home box instead. A search button in the top bar opens the dialog too.

**What it searches**

- Drugs: all of `DRUG_DB`, by generic name, brand name and abbreviation. It reuses the Mixing Guide's matcher (`searchDrugs`, `SEARCH_ALIASES`). The matcher moves to `lib/drug-search.ts`. The Mixing Guide imports it from there and behaves as before.
- Calculators: the 12 in the catalog, by label and keywords (for example "ibw", "bmi", "auc", "creatinine").
- Tools: the six tabs, by name.

**Results.** For a typed query, three sections in this order: Drugs (at most 6), Calculators (at most 4), Tools (at most 3). The panel omits an empty section. The arrow keys move through one flat list across sections.

- A drug row has three actions: Mixing Guide, Drug Reference, Ask Copilot. Enter runs Mixing Guide. While a drug row is active, Tab and Shift+Tab move between its three actions. Escape closes the list, and Tab then moves focus as usual. A click runs the clicked action.
- A calculator row opens that calculator.
- A tool row opens that tab.
- When nothing matches, one row reads: Ask Infusion Copilot about "*query*". It puts the query in the Copilot's question box, unsent.

With an empty query the dialog lists the recent items, then the six tools. The home box shows no list; the cards sit below it.

**Ask Copilot for a drug** puts "*Generic name*: " in the Copilot's question box, unsent, with the caret at the end. If the Copilot is locked, the text appears after unlock, as it does today.

**Dialog behaviour.** The dialog uses `role="dialog"` and `aria-modal` and traps focus. Escape or a click outside closes it. Focus then returns to where it was. The dialog sits above the Drug Reference modal and the Copilot history drawer.

The input follows the combobox pattern (a text box that controls a result list) with `aria-activedescendant`. Enter pressed while an input-method keyboard is composing a character selects nothing.

The dialog renders inside the app's root element. A global `body > *` rule breaks `position: fixed` on elements rendered directly under `body`. The top menu's backdrop blur breaks it inside the menu.

## 5. Calculators page

The selector becomes four labelled rows:

| Group | Calculators |
|---|---|
| Antimicrobials | IDSA Antibiotic Advisor, Vancomycin AUC Dosing, CADD Bag Calculator |
| Infusion prep & rates | Diluent Volume / Bag Prep, IVIG Infusion Rate, Biologic Rate Titration |
| Patient measures | CrCl (Cockcroft-Gault), Body Weight & BMI, Corrected Calcium |
| Anemia & labs | Iron Deficit (Ganzoni), ESA Dosing (CKD Anemia), HBV Serology Interpreter |

The page remembers the calculator used last (`switchrx.calculators.last.v1`) and opens on it. With nothing stored it opens on CADD Bag, as today.

## 6. Top menu

- 1280px and wider: full labels, as today, plus the search button ("Search" and the shortcut hint).
- 1024px to 1279px: short labels (Switching, Copilot, Calculators, Reference, Mixing, Break Room). Each button keeps its full name as its accessible name. The search button shows its icon and the hint.
- Labels stay on one line.

## 7. How it fits together

`app/page.tsx` owns navigation. It gets one function, `go(target)`:

```ts
type Target =
  | { kind: 'tool'; tab: TabId }
  | { kind: 'calculator'; id: CalcId }
  | { kind: 'drug'; id: string; dest: 'mixing' | 'reference' | 'copilot' }
  | { kind: 'ask'; text: string };
```

`go` switches the tab and hands the tool its request with a fresh token (a number that changes on every request), the way `pendingDrug` works today. A token lets the same request apply twice in a row. `go` also records drugs and calculators in the recent list.

| Unit | Job |
|---|---|
| `lib/launcher/catalog.ts` | The six tools and 12 calculators as data: id, label, short label, group, keywords. `CalcId` and `TabId` types. |
| `lib/drug-search.ts` | The drug matcher moved out of `MixingGuide.tsx`. |
| `lib/launcher/search.ts` | `searchAll(query)` returns the sections of section 4. Pure (no side effects). |
| `lib/launcher/recents.ts` | Add, cap at five, remove duplicates, load and save through a storage object passed in. Pure. |
| `components/launcher/SearchPanel.tsx` | Input, results, keyboard. Calls `onGo(target)`. |
| `components/launcher/CommandPalette.tsx` | Dialog shell and the global shortcut. |
| `components/launcher/Launcher.tsx` | The home page. |
| `ClinicalCalculators.tsx` | Reads the catalog, shows groups, takes an `openCalc` request, saves the last one used. A `Record<CalcId, …>` map makes the compiler reject a calculator missing from the page. |
| `MixingGuide.tsx` | Takes an `openDrug` request and selects that drug. |

A drug or calculator opened inside a tool also joins the recent list. Three places record it: the Mixing Guide's `choose`, the Drug Reference modal opening, and the Calculators selector.

**Storage.** `switchrx.recents.v1` holds up to five entries of `{ kind, id, dest? }`. It holds drug and calculator ids only, and nothing the user typed. The page reads it after hydration (once React takes over the server-rendered page), so the server and first client render agree.

## 8. Edge cases

- Storage blocked or full: recents and the last calculator last only until the page reloads. The page shows no error.
- On load, the page drops a stored id that no longer exists.
- A recent drug reopened in a new place keeps one entry, with the newest place.
- Escape with the dialog open closes only the dialog, not a modal under it.

## 9. Testing

**Unit tests (Vitest, node):**

- `drug-search`: the same ranking and aliases as before the move.
- `searchAll`: section order, caps, keyword matches, the no-match row, empty query.
- `recents`: cap, duplicates removed, newest first, unknown ids dropped, storage that throws.
- `catalog`: unique ids, every calculator in exactly one group.

**Browser checks**, local then on a Vercel preview, in both themes at 1024, 1280 and 1440px:

1. Cmd+K, "vanc", Enter opens the vancomycin Mixing Guide card.
2. Tab to Drug Reference, Enter opens the vancomycin monograph.
3. "crcl", Enter opens the CrCl calculator.
4. An unmatched query offers the Copilot row and fills the question box.
5. Recents show, cap at five and reopen the right place after a reload.
6. The Calculators page reopens on the calculator used last.
7. A keyboard-only pass: open, move, act, close, focus returns.
8. Menu labels sit on one line at 1024px with no sideways scroll.

The user reviews the preview before the merge.

## 10. Stage 2, for context only

Stage 2 gets its own spec after this ships. It sets a 13px minimum text size in the existing tools. It makes results (doses, rates, volumes) the most prominent text on each screen. It also gives Calculators, Switching Protocols, Drug Reference and Break Room the headers, cards, buttons and fields of the Copilot and Mixing Guide.

In dark theme today, 82% of Drug Reference text and 45% of Calculators text is 12px or smaller. Contrast passes 4.5:1 except the separator dots in Drug Reference (3.5:1).
