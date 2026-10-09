// The pre-market race rule book. To add a rule: write it in the matching file and add it to that file's list.
//   elimination-rules   → out for the day (permanent)
//   qualification-rules → waiting on the side (temporary)
//   scoring-rules       → factors multiplied into the 0-100 score that ranks the race
//   warning-rules       → flags shown to the trader
import { eliminationRules } from './elimination-rules';
import { qualificationRules } from './qualification-rules';
import { scoringRules } from './scoring-rules';
import { warningRules } from './warning-rules';
import { IRuleDescription } from './race-rule.types';

export { eliminationRules } from './elimination-rules';
export { qualificationRules } from './qualification-rules';
export { scoringRules, scoreRacer } from './scoring-rules';
export { warningRules } from './warning-rules';
export { buildRaceFacts, averageTrueRangePct } from './race-facts';
export * from './race-rule.types';

export const describeRuleBook = (): IRuleDescription[] => [
    ...eliminationRules.map((rule) => ({ kind: 'elimination' as const, title: rule.title, description: rule.describe() })),
    ...qualificationRules.map((rule) => ({ kind: 'qualification' as const, title: rule.title, description: rule.describe() })),
    ...scoringRules.map((rule) => ({ kind: 'scoring' as const, title: rule.title, description: rule.describe() })),
    ...warningRules.map((rule) => ({ kind: 'warning' as const, title: rule.title, description: rule.describe() })),
];
