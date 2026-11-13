# Match: one look across the tools

Date: 2026-11-12. Status: approved in conversation; the user waived written review ("yes proceed without my review"). Stage 2 of the UI/UX work, second of two previews. The first is `2026-11-11-read-design.md`.

## 1. Purpose

This stage gives the four older tools the same page header, input fields, buttons, mode switches and section cards. The four tools are Switching Protocols, Clinical Calculators, Drug Reference and the Break Room.

Today the tools differ visibly:

- Page headers come in three styles: an icon tile with a white title, a gold label over a gold title, and the Copilot's centred heading.
- IVIG and Biologic title their calculator twice: once in the panel header, once in their own heading.
- Input fields come in three families: a light tint at 14px, a dark fill at 16px, and Switching Protocols' pill-shaped dropdowns.
- Either/or choices use about eight different button styles.

**Success criteria**

1. Every tool page in scope opens with the same header component.
2. IVIG and Biologic show their name once.
3. Every typed field and dropdown in scope uses the shared field style.
4. Every either/or choice in scope uses the shared mode switch, and each switch still changes exactly what it changed before.
5. A source test fails if a tool in scope styles its own field, primary button or mode switch instead of using the shared pieces.
6. The 13px text floor and the main-answer style from "Read" still hold.
7. At 1280px and 1440px, in dark and light themes: no text clipped, no new sideways scrolling.
8. Clinical content and calculations do not change. The diff touches nothing in `data/` and no calculation function.

**Decisions the user made**

- Header: an icon tile and a white title, the style three tools already use.
- Fields: the darker, larger style from IVIG and Biologic.
- Buttons: three shared kinds. A primary button, a quiet button, and a mode switch for every either/or choice.

## 2. Scope

**In scope:**

- Switching Protocols (page header in `app/page.tsx`, the tool in `components/SwitchingProtocols.tsx`).
- Clinical Calculators (`ClinicalCalculators.tsx`, `IVIGRateCalculator.tsx`, `InfusionRateCalculator.tsx`, `DiluentVolumeAdvisor.tsx`, `IDSAAntibioticAdvisor.tsx`).
- Drug Reference (page header only).
- Mixing Guide (page header only).
- Break Room (page header and its primary buttons).

**Out of scope:**

- The Copilot, the launcher and the Mixing Guide's body. They are the reference look.
- Search boxes. Drug Reference, the Mixing Guide, the launcher and the Diluent drug search keep their own large search style.
- Multi-select chips, such as the IDSA allergy chips and the Drug Reference category filters. They are not either/or choices.
- The phone layout.
- Anything about what a calculator computes or says.

## 3. Shared pieces

All live in `components/ui/`. Their class strings live in one module, `components/ui/styles.ts`, so a tool cannot redefine them.

**`PageHeader`** (`icon`, `title`, `description`)
- A violet icon tile (`bg-violet-500/10`, `border-violet-500/20`, `p-2.5`, `rounded-xl`, icon `text-violet-400` at 20px).
- A 30px bold white title (`text-3xl font-bold tracking-tight text-white`).
- A 15px muted description below.
- The icon comes from `TOOL_ICONS` (`components/launcher/icons.ts`), so the header matches the menu and the launcher card.

**Field style** (`fieldClass`, `labelClass`)
- `fieldClass`: dark fill (`bg-black/30`), hairline border, `rounded-lg`, `px-3 py-2.5`, 16px medium white text, violet focus ring. Light theme already remaps `bg-black/30` to a soft parchment tint.
- `labelClass`: the existing 13px uppercase muted label.
- Native `<select>` elements use `fieldClass` with room for their chevron.
- Switching Protocols' custom dropdown triggers use `fieldClass` instead of their pill shape.
- Units stay where they are today: in the label (`DOSE (MG)`) or inside the box on the right. This stage changes the box, not where units sit.

**`Button`** (`variant`: `'primary' | 'quiet'`, plus the usual button props)
- Primary: the existing gold `btn-premium` look, `rounded-xl`. One per screen, for the main action.
- Quiet: the Copilot's bar-button look (`border-white/10`, `bg-white/5`, 13px medium, slate text, `rounded-lg`), for secondary actions.

**`Segmented`** (`options: { value, label }[]`, `value`, `onChange`, `ariaLabel`, `size?: 'md' | 'sm'`, `disabled?`)
- The mg/hr | mL/hr switch's look: a dark track with a hairline border and `p-0.5`. The active option gets a violet tint; the others are muted.
- `role="group"` with an `aria-label`. Each option is a button with `aria-pressed`.
- `size="sm"` is for a switch inside a field (kg | lb), which sits in the field's right side.

**`SectionCard`** (`icon`, `title`, `children`, `tone?: 'neutral' | 'violet'`)
- A soft tint (`bg-white/5`), hairline border, `rounded-2xl`, `p-5`.
- A header row with a 14px violet icon and a 13px uppercase muted title.
- `tone="violet"` is the summary card's violet tint, used by the IVIG and Biologic administration summaries.

## 4. Changes per tool

**Page headers.** `PageHeader` replaces:

| Tool | Before | After |
|---|---|---|
| Switching Protocols | "PROTOCOLS" label over gold "Medication Switching" | "Switching Protocols" |
| Clinical Calculators | its own tile and title | same text |
| Drug Reference | gold-tinted tile | violet tile, same text |
| Mixing Guide | its own tile and title | same text |
| Break Room | "RECHARGE" label over gold "The Break Room" | "Break Room" |

The descriptions keep today's wording.

**Doubled headings.** IVIG and Biologic drop their own `h3` title ("IVIG Rate Calculator", "Infusion Rate Calculator"). The badge, the one-line description and the "Copy chart for EMR" button stay in one row under the panel title.

**Mode switches.** `Segmented` replaces:

| Where | Options |
|---|---|
| Vancomycin AUC Dosing | Empiric / From Levels / Bayesian (MAP) |
| ESA Dosing | the agent choice |
| HBV Serology Interpreter | Positive / Negative / Not done, for each marker |
| Calculators' in-field unit toggles (`UnitToggle`, 9 uses) | cm / in, kg / lb, as a `size="sm"` switch inside the field |
| IVIG | PI / MMN / CIDP; kg / lbs |
| Biologic | mg/hr / mL/hr |
| IDSA | Male / Female; pregnancy; Normal / Child-Pugh A / B / C; Mild / Moderate / Severe |
| Switching Protocols | Current Therapy / Patient Context; Setup / Suggestions |

Each switch keeps the same values, the same state setter and the same default.

**Buttons.**
- Primary: Switching Protocols' "Find switching protocols", IDSA's "Generate OPAT recommendation" (emerald today), the Diluent search's "Check", and the Break Room's game-start buttons.
- Quiet: "Copy chart for EMR" (IVIG, Biologic) and the HBV "Reset".

**Section cards.** `SectionCard` replaces:
- IVIG: Condition, Patient Weight, Total Dose, Administration Summary.
- Biologic: Drug Preset, Bag Composition, Titration Parameters, Administration Summary.
- Switching Protocols: Current Therapy, Switching Parameters.

**Fields.** The three per-file `inputCls` and `labelCls` constants are replaced by imports of `fieldClass` and `labelClass`. They live in `ClinicalCalculators.tsx`, `DiluentVolumeAdvisor.tsx` and `IDSAAntibioticAdvisor.tsx`. The IVIG and Biologic fields switch to `fieldClass`, and so do Switching Protocols' dropdown triggers.

## 5. Edge cases

- A field with an in-field unit switch reserves room on its right, so a long number never runs under the switch.
- A disabled switch (Biologic before dose and volume) shows the disabled look and keeps its hint.
- Switching Protocols' sliding active pill (an animation) gives way to the static `Segmented` style. The animation is lost.
- Light theme: `bg-black/30` is remapped to a parchment tint, and the violet active option is remapped to the theme's violet.

## 6. Testing

**Unit tests (Vitest, node):**
- A source scan of the in-scope files fails on any of these:
  - a local `inputCls` or `labelCls` definition;
  - `btn-premium` used outside `components/ui/` (the Copilot gate is exempt);
  - an input or select whose class string sets its own background instead of using `fieldClass`. Checkboxes, radios and the search boxes of section 2 are exempt.
- The scan also checks that every tool page in scope renders `PageHeader`.
- The existing 13px floor test stays.

**Browser checks**, local then on the Vercel preview, at 1280px and 1440px in both themes:
1. Every tool shows the same header. Switching Protocols reads "Switching Protocols".
2. IVIG and Biologic show their name once.
3. Each switch in section 4 changes what it changed before. For example: Vancomycin modes swap their inputs, IVIG's condition changes the dose range, kg ↔ lb converts the weight, and HBV's answers drive the same interpretation.
4. The clipping, overflow and below-13px checks from "Read" find nothing.
5. Stage 1's checks still pass: Cmd+K, the launcher, and the menu on one line at 1024px.

The user reviews the preview before the merge.
