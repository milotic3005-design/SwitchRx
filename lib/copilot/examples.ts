/**
 * Starter questions for the Copilot home screen. They only fill the question box; nothing is sent until
 * the user submits. They are questions, never answers, and carry no patient identifiers.
 */

export interface Shortcut {
  label: 'Dose & renal adjustment' | 'Preparation & stability' | 'Infusion reactions';
  /** What goes into the question box when the chip is picked. */
  text: string;
}

export interface ExampleCategory {
  title: string;
  /** 2-3 example questions. */
  examples: string[];
}

export const SHORTCUTS: Shortcut[] = [
  {
    label: 'Dose & renal adjustment',
    text: 'How should cefepime be dosed for an adult with a creatinine clearance of 30 mL/min?',
  },
  {
    label: 'Preparation & stability',
    text: 'How should infliximab be reconstituted and diluted, and how long is the prepared bag stable?',
  },
  {
    label: 'Infusion reactions',
    text: 'How should a mild to moderate infusion reaction to rituximab be managed, and when can the infusion be restarted?',
  },
];

export const EXAMPLE_CATEGORIES: ExampleCategory[] = [
  {
    title: 'Dosing & renal adjustment',
    examples: [
      'How should daptomycin be dosed in a patient on intermittent hemodialysis?',
      'Should vancomycin be dosed on actual or adjusted body weight in a patient with obesity?',
      'What dose adjustments does piperacillin-tazobactam need as renal function declines?',
    ],
  },
  {
    title: 'Preparation, stability & BUD',
    examples: [
      'What beyond-use date applies to a pharmacy-prepared vancomycin minibag stored in the refrigerator?',
      'How long is a prepared piperacillin-tazobactam bag stable at room temperature compared with refrigerated?',
      'Which diluents and final concentrations are acceptable for ertapenem?',
    ],
  },
  {
    title: 'Administration & rates',
    examples: [
      'What infusion rate and duration are recommended for ferric carboxymaltose?',
      'How should the first rituximab infusion be titrated, and how does the rate change for later doses?',
      'What is the maximum infusion rate for vancomycin, and how does rate relate to infusion-related reactions?',
    ],
  },
  {
    title: 'Premeds & infusion reactions',
    examples: [
      'What premedication is recommended before paclitaxel to reduce hypersensitivity reactions?',
      'How can an infusion reaction be told apart from anaphylaxis, and when is epinephrine indicated?',
      'Which premedications are commonly used before amphotericin B, and is there evidence they help?',
    ],
  },
  {
    title: 'Monitoring & TDM',
    examples: [
      'Is AUC-guided or trough-guided monitoring preferred for vancomycin, and what AUC target is recommended?',
      'Which labs should be monitored during outpatient daptomycin therapy, and how often?',
      'How should aminoglycoside levels be monitored with extended-interval dosing?',
    ],
  },
  {
    title: 'Compatibility & line access',
    examples: [
      'Is ceftriaxone compatible with calcium-containing solutions in the same IV line?',
      'Can vancomycin and piperacillin-tazobactam be run through the same Y-site?',
      'What drug characteristics call for central venous access instead of a peripheral IV?',
    ],
  },
  {
    title: 'OPAT & home infusion',
    examples: [
      'Which antibiotics are well suited to once-daily home infusion for OPAT?',
      'What weekly lab monitoring is recommended for patients receiving cefazolin through OPAT?',
      'When is a PICC preferred over a midline catheter for a multi-week OPAT course?',
    ],
  },
  {
    title: 'Biologics & biosimilars',
    examples: [
      'Can a patient stable on infliximab be switched to a biosimilar, and is re-induction needed?',
      'What screening is recommended before starting an infused TNF inhibitor?',
      'Which tocilizumab biosimilars are approved, and are they interchangeable with the reference product?',
    ],
  },
  {
    title: 'Oncology supportive care',
    examples: [
      'What hydration and electrolyte measures are recommended with cisplatin to reduce nephrotoxicity?',
      'How should doxorubicin extravasation be managed?',
      'How soon after chemotherapy can pegfilgrastim be given, and what interval is needed before the next cycle?',
    ],
  },
  {
    title: 'Shortages & alternatives',
    examples: [
      'What therapeutic alternatives are reasonable when cefazolin is on shortage?',
      'What conservation strategies are recommended during a shortage of IV fluids?',
    ],
  },
];
