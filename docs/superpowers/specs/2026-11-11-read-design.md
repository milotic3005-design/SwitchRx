# Read: a 13px text floor and one style for main answers

Date: 2026-11-11. Status: awaiting review. Stage 2 of the UI/UX work, first of two previews. Stage 1 is `2026-11-10-find-it-fast-design.md`.

## 1. Purpose

This stage makes every screen readable at a desk: no text below 13px, and each calculator's main answer the most prominent thing in its panel.

Today about 360 places across 22 files set text to 12px or smaller. In dark theme, 82% of Drug Reference text and 45% of Calculators text is 12px or smaller, and some labels are 10px. Each calculator styles its answer its own way: CrCl shows a 20px number in a tinted bar, Vancomycin a 30px number, and the Body Weight calculator shows ideal body weight as a 14px line.

**Success criteria**

1. In every tool and both themes, no visible text renders below 13px, measured in the browser. The only exemption is the playing-card faces in the Break Room's Solitaire.
2. Every main answer in section 4's table uses the shared style.
3. At 1280px and 1440px wide, no box clips its text, no text overlaps, and no panel gains sideways scrolling.
4. A test fails when the source gains a text size below 13px that the floor does not cover.
5. Clinical content and calculations do not change. The diff touches nothing in `data/` and no calculation function.

**Decisions the user made**

- The 13px minimum applies to the whole app, the Copilot included.
- Shared styles, shown in two previews. This spec is the first preview.
- Main answers get one shared style.

## 2. Scope

**In scope:** the text floor, a fix-up pass on every tool, and the main-answer style.

**Out of scope:**

- Page headers, cards, buttons and input fields. They are the second preview ("Match"), with the doubled headings in the IVIG and Biologic calculators.
- The phone layout, a sidebar, and denser layouts.
- Any change to what a calculator computes or says.

## 3. Text floor

**Mechanism.** `app/globals.css` gains a block named "Readability floor", beside the theme's colour remap. It sets `font-size: 13px` for every small text class the app uses: `text-[8px]` through `text-[12px]`, and `text-xs`. One rule covers all 360 places, the way the theme was applied.

- `.cc-eyebrow` (12px today) and `.cc-navlink` (11px) move to 13px.
- Four chart axis labels in the IVIG and Biologic calculators set their size in code. They move to 13.
- One Break Room label sets 9px in code. It drops the inline size.
- Uppercase labels with wide letter-spacing (`tracking-wider`, about 77 places) move to `0.02em` spacing through one rule in the same block, so the larger text takes less extra room.

**Exemption.** A Solitaire card sizes its rank and suit to the card. They stay as they are.

**Guard test.** A node test reads every `.tsx` file under `app/` and `components/`. It collects each text-size class below 13px and each numeric inline `fontSize` below 13. It fails when a class is missing from the floor block, or when an inline size sits outside the exempt Solitaire lines.

## 4. Main answers

**The style.** A main answer has three parts: a 13px label above, the number at 28px bold with tabular figures (digits of equal width), and its unit at 15px beside it. Before any input it reads "Enter values above" at 13px in the same box. Supporting numbers use 15px.

A table has no room for 28px in five columns. There the main rows show their numbers at 18px bold, and the other rows at 13px.

**One component.** `components/ui/MainAnswer.tsx` renders the single-answer form. It replaces the `ResultBadge` helper in `ClinicalCalculators.tsx`. Bespoke blocks (Vancomycin, ESA) and tables use the same CSS classes directly: `.answer-label`, `.answer-value`, `.answer-unit`, `.answer-key`.

**Colour.** A main answer is neutral unless its colour carries a clinical signal the calculator already computes. Amber and rose are reserved for signals across this app.

- Colour stays where it signals: the Vancomycin AUC (in range, below, above) and the BMI category.
- Colour goes where it only decorates: Corrected Calcium (always rose today), Iron Deficit (always amber), CrCl (blue) and Adjusted Body Weight (green) become neutral.

**Which numbers are main answers.** This table needs the user's check.

| Calculator | Main answer | Form |
|---|---|---|
| IDSA Antibiotic Advisor | None. It gives a written recommendation. | Text floor only |
| Vancomycin AUC Dosing | Recommended maintenance regimen (dose and interval). With levels entered: the measured or Bayesian AUC₂₄ as well. | 28px |
| CADD Bag Calculator | Bag Volume (mL) and Final Bag Dose, for each duration | 18px rows in its table |
| Diluent Volume / Bag Prep | Final volume in bag, and final concentration | 28px |
| IVIG Infusion Rate | The rate of each step (mL/hr). In the summary: Max Target Rate and Est. Completion. | 18px column; 28px summary |
| Biologic Rate Titration | The pump rate of each step, and the final pump rate | 18px column |
| CrCl (Cockcroft-Gault) | Est. CrCl (mL/min) | 28px |
| Body Weight & BMI | Ideal body weight, adjusted body weight, and BMI | 28px, three answers |
| Corrected Calcium | Corrected Ca (mg/dL) | 28px |
| Iron Deficit (Ganzoni) | Total iron deficit (mg) | 28px |
| ESA Dosing (CKD Anemia) | Starting dose, and the titration action | 28px |
| HBV Serology Interpreter | The interpretation (status line) | 20px text |

Ideal body weight is new to this list: today it is a 14px line above the two tinted answers.

## 5. Fix-up pass

After the floor is in, every tool gets a walk-through at 1280px and 1440px wide, in dark and light theme: the launcher, all 12 calculators, Drug Reference (grid and monograph), Switching Protocols (setup and suggestions), the Mixing Guide (search and a drug card), the Copilot (home, a finished answer, the history drawer, the lock screen) and the Break Room.

A defect is text that a box clips, text that overlaps its neighbour, a table header that wraps onto two lines, or a panel that newly scrolls sideways. The fix changes that tool's layout classes: a column width, a wrap rule, a gap. It never exempts text from the floor.

## 6. Edge cases

- Light theme: the floor has no theme-specific rule, so both themes get it.
- A long drug name in a table cell wraps inside its cell and does not widen the table.
- The Copilot's citation chips and source cards grow with their text and must stay inside the answer column.
- This stage changes only how things look. It reads and writes no stored data.

## 7. Testing

**Unit tests (Vitest, node):** the guard test of section 3.

**Browser checks**, local then on a Vercel preview:

1. A measuring script walks every tool and reports the share of visible text below 13px. Pass: 0% outside the Solitaire cards. The script counted 82% for Drug Reference before this stage.
2. Sample values go into each calculator in section 4. Its main answer shows in the shared style, at the stated size.
3. Corrected Calcium, Iron Deficit, CrCl and Adjusted Body Weight show neutral. A Vancomycin AUC out of range and an obese BMI still show their signal colour.
4. The walk-through of section 5 finds no defect at 1280px and 1440px in both themes.
5. Stage 1's checks still pass: Cmd+K, the launcher, the menu on one line at 1024px.

The user reviews the preview before the merge.

## 8. Second preview, for context only

"Match" gets its own spec after this ships. It gives Switching Protocols the page header the other tools use, removes the doubled headings in the IVIG and Biologic calculators, and applies shared card, button and field styles to Calculators, Switching Protocols, Drug Reference and the Break Room.
