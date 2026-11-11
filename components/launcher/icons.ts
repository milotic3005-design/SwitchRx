import { Beaker, Calculator, Coffee, FlaskConical, Network, Repeat, type LucideIcon } from 'lucide-react';
import type { TabId } from '@/lib/launcher/catalog';

/** Each tool's icon, the same in the top menu, the launcher and the search. */
export const TOOL_ICONS: Record<TabId, LucideIcon> = {
  switching: Repeat,
  infusion: Network,
  calculators: Calculator,
  drugref: FlaskConical,
  mixing: Beaker,
  breakroom: Coffee,
};
