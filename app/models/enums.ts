export enum BuyDirectionEnum {
    NONE = 0,
    CALL = 1,
    PUT = 2,
}

export enum buyReasonEnum {
    NONE = '',
    AS_FIRST_VOLUME_INTERVAL = 'As First Volume ',
    SUPER_VOLUME_INTERVAL = ' SUPER Volume',
    MULTIPLE_HIGH_AVERAGE_VOLUME = 'Multiple Intervals Exceed Average Volume',
    BULLISH_HIGH_OF_DAY_WITH_PRIOR_DAY_BREAKOUT = 'Bullish High Of Day With Prior Day Breakout',
}

export enum SignalVerificationReasonEnum {
    NONE = '',
    AS_FIRST_VOLUME_INTERVAL = 'As First Volume ',
    SUPER_VOLUME_INTERVAL = ' SUPER Volume',
    MULTIPLE_HIGH_AVERAGE_VOLUME = 'Multiple Intervals Exceed Average Volume',
    BULLISH_HIGH_OF_DAY_WITH_PRIOR_DAY_BREAKOUT = 'Bullish High Of Day With Prior Day Breakout',
    BULLISH_HIGH_OF_DAY = 'Bullish High Of Day',
    BULLISH_HIGH_OF_DAY_WITH_PREMARKET_BREAKOUT = 'Bullish High Of Day With Premarket Breakout',
    BULLISH_BREAK_PREVIOUS_DAY = 'Bullish Break Previous Day',
    BULLISH_BREAK_PREVIOUS_WEEK = 'Bullish Break Previous Week',
}

export enum TimeFrame {
    FiveMinutes,
    Hourly,
    FourHours,
    Daily,
    Weekly,
    Monthly,
}
