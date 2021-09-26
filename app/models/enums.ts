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
    VOLUME_AVERAGE_SPIKE = 'Volume spike obove last 10 average Volume',
    BULLISH_HIGH_OF_DAY_WITH_PRIOR_DAY_BREAKOUT = 'Bullish High Of Day With Prior Day Breakout',
    BULLISH_HIGH_OF_DAY = 'Bullish High Of Day',
    BULLISH_HIGH_OF_DAY_WITH_PREMARKET_BREAKOUT = 'Bullish High Of Day With Premarket Breakout',
    BULLISH_BREAK_PREVIOUS_DAY = 'Bullish Break Previous Day',
    BULLISH_BREAK_PREVIOUS_WEEK = 'Bullish Break Previous Week',
    BULLISH_BREAK_52_WEEK_HIGH = 'Bullish Break 52 week High',
}

export enum TimeFrame {
    FiveMinutes,
    Hourly,
    FourHours,
    Daily,
    Weekly,
    Monthly,
}

export enum MovingAverageType {
    SMA10 = 10,
    SMA20 = 20,
    SMA50 = 50,
    SMA100 = 100,
    SMA200 = 200,
}
