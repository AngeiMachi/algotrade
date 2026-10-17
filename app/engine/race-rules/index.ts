// The pre-market race rule book. To add a rule: write it in the matching file and add it to that file's list.
//   keep-rules          → stays on the board whatever elimination and qualification say
//   elimination-rules   → out for the day (permanent)
//   qualification-rules → listed aside (temporary)
//   scoring-rules       → factors multiplied into the 0-100 score that ranks the race
//   warning-rules       → risks shown to the trader
//   highlight-rules     → good setups shown to the trader
import { eliminationRules } from './elimination-rules';
import { qualificationRules } from './qualification-rules';
import { scoringRules } from './scoring-rules';
import { warningRules } from './warning-rules';
import { highlightRules } from './highlight-rules';
import { keepRules } from './keep-rules';
import { IRuleDescription } from './race-rule.types';

export { keepRules } from './keep-rules';
export { eliminationRules } from './elimination-rules';
export { qualificationRules } from './qualification-rules';
export { scoringRules, scoreRacer } from './scoring-rules';
export { warningRules, tradingThroughSma } from './warning-rules';
export { highlightRules } from './highlight-rules';
export {
    buildRaceFacts,
    averageTrueRangePct,
    dailyBollingerBand,
    dailySmas,
    dailyTrend,
    yesterdayOpenedBelowSma,
    IDailySmas,
    IDailyTrend,
    IPriorHourlyCandle,
    IYesterdayBelowSma,
} from './race-facts';
export * from './race-rule.types';
export { IDailyCandle } from './chart-patterns';

export const describeRuleBook = (): IRuleDescription[] => [
    ...keepRules.map((rule) => ({ kind: 'keep' as const, title: rule.title, description: rule.describe() })),
    ...eliminationRules.map((rule) => ({ kind: 'elimination' as const, title: rule.title, description: rule.describe() })),
    ...qualificationRules.map((rule) => ({ kind: 'qualification' as const, title: rule.title, description: rule.describe() })),
    ...scoringRules.map((rule) => ({ kind: 'scoring' as const, title: rule.title, description: rule.describe() })),
    ...warningRules.map((rule) => ({ kind: 'warning' as const, title: rule.title, description: rule.describe() })),
    ...highlightRules.map((rule) => ({ kind: 'highlight' as const, title: rule.title, description: rule.describe() })),
];
