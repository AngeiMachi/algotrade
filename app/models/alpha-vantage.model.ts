export const INTERVAL_PROPERTY_NAME = "Time Series (5min)";
export const METADATA_PROPERTY_NAME = "Meta Data";
export const LAST_REFRESHED_PROPERTY_NAME = "3. Last Refreshed";

export interface IAlphaVantageQuoteData {
    [METADATA_PROPERTY_NAME]: any;
    [INTERVAL_PROPERTY_NAME]: any;
}
export interface IAlphaVantageIntervals {
    [key: string]: any;
}