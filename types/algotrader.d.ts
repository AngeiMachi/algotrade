declare module 'algotrader' {
    export namespace Algorithm {
        class Scheduler {
            constructor(f: any);
            f: any;
            job: any;
            cancel(): any;
            every(minutes: any, extended: any): any;
            getNext(): any;
            onMarketClose(offset: any): any;
            onMarketOpen(offset: any): any;
        }
    }
}
/**    
}
export namespace Algorithm {
    class Scheduler {
        constructor(f: any);
        f: any;
        job: any;
        cancel(): any;
        every(minutes: any, extended: any): any;
        getNext(): any;
        onMarketClose(offset: any): any;
        static onMarketOpen(offset: any, func:Function): any;
    }
}
export namespace Data {
    class AlphaVantage {
        constructor(apiKey: any);
        apiKey: any;
        url: any;
        adx(symbol: any, interval: any, timePeriod: any): any;
        bbands(symbol: any, interval: any, timePeriod: any, seriesType: any, nbdevup: any, nbdevdn: any, matype: any): any;
        dema(symbol: any, interval: any, timePeriod: any, seriesType: any): any;
        ema(symbol: any, interval: any, timePeriod: any, seriesType: any): any;
        kama(symbol: any, interval: any, timePeriod: any, seriesType: any): any;
        macd(symbol: any, interval: any, timePeriod: any, seriesType: any, fastPeriod: any, slowPeriod: any, signalPeriod: any, fastMaType: any, slowMaType: any, signalMaType: any): any;
        mama(symbol: any, interval: any, timePeriod: any, seriesType: any, fastLimit: any, slowLimit: any): any;
        minus_di(symbol: any, interval: any, timePeriod: any): any;
        plus_di(symbol: any, interval: any, timePeriod: any): any;
        rsi(symbol: any, interval: any, timePeriod: any, seriesType: any): any;
        sectorPerformance(): any;
        sma(symbol: any, interval: any, timePeriod: any, seriesType: any): any;
        stoch(symbol: any, interval: any, timePeriod: any, seriesType: any, fastKPeriod: any, slowKPeriod: any, slowDPeriod: any, slowKmaType: any, slowDmaType: any): any;
        stochRSI(symbol: any, interval: any, timePeriod: any, seriesType: any, fastKPeriod: any, fastDPeriod: any, fastDmaType: any): any;
        stochf(symbol: any, interval: any, timePeriod: any, seriesType: any, fastKPeriod: any, fastDPeriod: any, fastDmaType: any): any;
        t3(symbol: any, interval: any, timePeriod: any, seriesType: any): any;
        tema(symbol: any, interval: any, timePeriod: any, seriesType: any): any;
        timeSeriesDaily(symbol: any, compact: any, adjusted: any): any;
        timeSeriesIntraday(symbol: any, interval: any): any;
        timeSeriesMonthly(symbol: any, adjusted: any): any;
        timeSeriesWeekly(symbol: any, adjusted: any): any;
        trima(symbol: any, interval: any, timePeriod: any, seriesType: any): any;
        wma(symbol: any, interval: any, timePeriod: any, seriesType: any): any;
    }
    class IEX {
        static getAllSymbols(): any;
        static getBatchQuotes(symbolArray: any): any;
        static getCompanyDetails(symbol: any): any;
        static getDividends(symbol: any): any;
        static getEarnings(symbol: any): any;
        static getFinancials(symbol: any): any;
        static getLogo(symbol: any): any;
        static getMarket(): any;
        static getNews(symbol: any): any;
        static getPeers(symbol: any): any;
        static getQuote(symbol: any): any;
        static getSplits(symbol: any): any;
        static getStats(symbol: any): any;
        static getVolumeByVenue(symbol: any): any;
    }
    class Nasdaq {
        static getByName(string: any): any;
        static getETFs(): any;
        static getListings(): any;
        static getOTCListings(): any;
        static getOtherListings(): any;
        static getTraded(): any;
    }
    class News {
        static getAll(apiKey: any, object: any): any;
        static getFromYahoo(symbol: any): any;
        static getHeadlines(apiKey: any, object: any): any;
        constructor(object: any);
        title: any;
        description: any;
        date: any;
        source: any;
        author: any;
        url: any;
        getArticle(): any;
        getAuthor(): any;
        getDate(): any;
        getDescription(): any;
        getSource(): any;
        getTitle(): any;
        getURL(): any;
    }
    class Query {
        static getEarnings(days: any): any;
        static getEarningsBySymbol(symbol: any): any;
        static getHighestOpenInterest(count: any): any;
        static getHighestVolume(count: any): any;
        static getSimilar(symbol: any): any;
        static getTopETFs(count: any): any;
        static getTopGainers(count: any): any;
        static getTopLosers(count: any): any;
        static getTrendingSymbols(count: any): any;
        static search(string: any): any;
    }
    class Stream {
        static defaultMaxListeners: any;
        static init(): void;
        static listenerCount(emitter: any, type: any): any;
        static usingDomains: boolean;
        constructor(symbols: any, options: any);
        symbols: any;
        iex: any;
        iexType: any;
        news: any;
        allHeadlines: any;
        newsApiKey: any;
        newsArray: any;
        addListener(type: any, listener: any): any;
        emit(type: any, args: any): any;
        eventNames(): any;
        getMaxListeners(): any;
        listenerCount(type: any): any;
        listeners(type: any): any;
        off(type: any, listener: any): any;
        on(type: any, listener: any): any;
        once(type: any, listener: any): any;
        prependListener(type: any, listener: any): any;
        prependOnceListener(type: any, listener: any): any;
        rawListeners(type: any): any;
        removeAllListeners(type: any, ...args: any[]): any;
        removeListener(type: any, listener: any): any;
        setMaxListeners(n: any): any;
        start(): void;
        stop(): void;
    }
    namespace Stream {
        class EventEmitter {
            // Circular reference from index.Data.Stream.EventEmitter
            static EventEmitter: any;
            static defaultMaxListeners: any;
            static init(): void;
            static listenerCount(emitter: any, type: any): any;
            static usingDomains: boolean;
            addListener(type: any, listener: any): any;
            emit(type: any, args: any): any;
            eventNames(): any;
            getMaxListeners(): any;
            listenerCount(type: any): any;
            listeners(type: any): any;
            off(type: any, listener: any): any;
            on(type: any, listener: any): any;
            once(type: any, listener: any): any;
            prependListener(type: any, listener: any): any;
            prependOnceListener(type: any, listener: any): any;
            rawListeners(type: any): any;
            removeAllListeners(type: any, ...args: any[]): any;
            removeListener(type: any, listener: any): any;
            setMaxListeners(n: any): any;
        }
    }
    class Yahoo {
        static getOptionsChain(symbol: any): any;
        static getQuotes(symbol: any, range: any, interval: any, extended: any): any;
    }
}
export namespace Globals {
    class OptionChain {
        constructor(array: any);
        array: any;
        getAsk(date: any, strike: any, side: any): any;
        getBid(date: any, strike: any, side: any): any;
        getByExpirationDate(date: any): any;
        getChange(date: any, strike: any, side: any): any;
        getExpirationDates(): any;
        getImpliedVolatility(date: any, strike: any, side: any): any;
        getLastPrice(date: any, strike: any, side: any): any;
        getLastTradeDate(date: any, strike: any, side: any): any;
        getNearestExpirationDate(targetDate: any): any;
        getNearestStrikePrice(date: any, side: any, priceTarget: any): any;
        getOpenInterest(date: any, strike: any, side: any): any;
        getStrikePrices(date: any, side: any): any;
        getVolume(date: any, strike: any, side: any): any;
        isInTheMoney(date: any, strike: any, side: any): any;
    }
    class Quote {
        static getVWAP(quoteArray: any): any;
        static priceChannel(quoteArray: any, period: any): any;
        constructor(object: any);
        symbol: any;
        date: any;
        source: any;
        price: any;
        dom: any;
        meta: any;
        original: any;
        getAdjustedClose(): any;
        getAskPrice(): any;
        getAskSize(): any;
        getBidPrice(): any;
        getBidSize(): any;
        getClose(): any;
        getDate(): any;
        getHigh(): any;
        getLast(): any;
        getLow(): any;
        getMeta(): any;
        getOHLC4(): any;
        getOpen(): any;
        getOriginal(): any;
        getSource(): any;
        getSymbol(): any;
        getVolume(): any;
    }
}
export namespace Robinhood {
    class Fundamentals {
        static getBySymbol(symbol: any): any;
        static getBySymbolArray(array: any): any;
        static getByURL(url: any): any;
        static handleResponse(error: any, response: any, body: any, token: any, resolve: any, reject: any): void;
        constructor(object: any);
        open: any;
        high: any;
        low: any;
        volume: any;
        averageVolume: any;
        marketCap: any;
        dividendYield: any;
        peRatio: any;
        description: any;
        get52WeekHigh(): any;
        get52WeekLow(): any;
        getAverageVolume(): any;
        getDescription(): any;
        getDividendYield(): any;
        getHeadquarters(): any;
        getHigh(): any;
        getLow(): any;
        getMarketCap(): any;
        getOpen(): any;
        getPERatio(): any;
        getVolume(): any;
    }
    class Instrument {
        static getAll(): any;
        static getByCategory(category: any): any;
        static getByID(id: any): any;
        static getByIdArray(ids: any): any;
        static getBySymbol(symbol: any): any;
        static getByURL(instrumentURL: any): any;
        static getCategories(): any;
        static getMostPopular(): any;
        static getRecommendations(user: any): any;
        static getTopMoving(direction: any): any;
        static getUpcomingEarnings(): any;
        static handleResponse(error: any, response: any, body: any, token: any, resolve: any, reject: any): void;
        constructor(object: any);
        name: any;
        simpleName: any;
        symbol: any;
        listDate: any;
        country: any;
        tradeable: any;
        type: any;
        bloomberg: any;
        state: any;
        id: any;
        urls: any;
        margin: any;
        equals(otherInstrument: any): any;
        getBloombergID(): any;
        getCountry(): any;
        getDayTradeRatio(): any;
        getEarnings(): any;
        getFundamentals(): any;
        getID(): any;
        getListDate(): any;
        getMaintenanceRatio(): any;
        getMarginInitialRatio(): any;
        getMarket(): any;
        getName(): any;
        getPopularity(): any;
        getPricesPaid(): any;
        getQuote(user: any): any;
        getRatings(): any;
        getSimpleName(): any;
        getSplits(): any;
        getState(): any;
        getSymbol(): any;
        getType(): any;
        isADR(): any;
        isActive(): any;
        isETP(): any;
        isStock(): any;
        isTradeable(): any;
        populate(user: any): any;
    }
    class Market {
        static getByMIC(code: any): any;
        static getByURL(url: any): any;
        static handleResponse(error: any, response: any, body: any, token: any, resolve: any, reject: any): void;
        constructor(object: any);
        parseHours: any;
        website: any;
        city: any;
        name: any;
        country: any;
        acronym: any;
        timezone: any;
        mic: any;
        hours: any;
        getAcronym(): any;
        getCity(): any;
        getClose(): any;
        getCode(): any;
        getCountry(): any;
        getExtendedClose(): any;
        getExtendedOpen(): any;
        getHours(): any;
        getHoursOn(date: any): any;
        getName(): any;
        getNextClose(): any;
        getNextOpen(): any;
        getNextTradingHours(): any;
        getOpen(): any;
        getPreviousTradingHours(): any;
        getWebsite(): any;
        isExtendedOpenNow(): any;
        isOpenNow(): any;
        isOpenOn(date: any): any;
        isOpenToday(): any;
    }
    class OptionInstrument {
        static getAll(user: any): any;
        static getByURL(user: any, url: any): any;
        static getChain(user: any, instrument: any, side: any): any;
        static getExpirations(user: any, instrument: any): any;
        static getPositions(user: any): any;
        static getPrices(user: any, instruments: any): any;
        static handleResponse(error: any, response: any, body: any, token: any, resolve: any, reject: any): void;
        constructor(object: any);
        tradability: any;
        strikePrice: any;
        state: any;
        type: any;
        symbol: any;
        minTicks: any;
        instrumentURL: any;
        ids: any;
        dates: any;
        getChainID(): any;
        getExpiration(): any;
        getInstrumentURL(): any;
        getMiniumumTicks(): any;
        getOptionID(): any;
        getState(): any;
        getStrikePrice(): any;
        getSymbol(): any;
        getTradability(): any;
        getType(): any;
        isCall(): any;
        isPut(): any;
    }
    class OptionOrder {
        static getOrders(user: any): any;
        static handleResponse(error: any, response: any, body: any, token: any, resolve: any, reject: any): void;
        constructor(user: any, object: any);
        user: any;
        executed: any;
        form: any;
        getChainID(): any;
        getDateCreated(): any;
        getDirection(): any;
        getLegs(): any;
        getPremium(): any;
        getPrice(): any;
        getProcessedPremium(): any;
        getQuantity(): any;
        getQuantityCanceled(): any;
        getQuantityPending(): any;
        getReferenceID(): any;
        getSymbol(): any;
        getTimeInForce(): any;
        getTrigger(): any;
        getType(): any;
        isCredit(): any;
        isDebit(): any;
        isExecuted(): any;
        submit(): any;
    }
    class Order {
        static cancelOpenOrders(user: any): any;
        static getByOrderID(user: any, orderID: any): any;
        static getRecentOrders(user: any): any;
        static handleResponse(error: any, response: any, body: any, token: any, resolve: any, reject: any): void;
        constructor(user: any, object: any);
        user: any;
        response: any;
        executed: any;
        order: any;
        cancel(): any;
        getResponse(): any;
        submit(): any;
    }
    class Portfolio {
        static handleResponse(error: any, response: any, body: any, token: any, resolve: any, reject: any): void;
        constructor(user: any, array: any);
        user: any;
        array: any;
        getBuyPrice(symbol: any): any;
        getBySymbol(symbol: any): any;
        getBySymbols(array: any): any;
        getInstrumentArray(): any;
        getLastTradeDate(symbol: any): any;
        getPriceEqualTo(amount: any): any;
        getPriceGreaterThan(amount: any): any;
        getPriceLessThan(amount: any): any;
        getPurchaseDate(symbol: any): any;
        getPurchasedAfter(date: any): any;
        getPurchasedBefore(date: any): any;
        getPurchasedOn(date: any): any;
        getQuantity(symbol: any): any;
        getQuantityEqualTo(size: any): any;
        getQuantityGreaterThan(size: any): any;
        getQuantityLessThan(size: any): any;
        getSharesHeld(symbol: any): any;
        getStockValue(): any;
        getSymbols(): any;
        sellAll(): any;
        setQuantity(symbol: any, targetQuantity: any): any;
    }
    class User {
        static deserialize(data: any): any;
        static handleResponse(error: any, response: any, body: any, token: any, resolve: any, reject: any): void;
        static isUser(object: any): any;
        static load(): any;
        constructor(username: any, password: any);
        username: any;
        password: any;
        token: any;
        account: any;
        expires: any;
        refreshToken: any;
        addDeposit(bankID: any, amount: any, frequency: any): any;
        authenticate(password: any, mfaFunction: any): any;
        cancelOpenOrders(): any;
        downloadDocuments(folder: any): any;
        getAccount(): any;
        getAccountNumber(): any;
        getAuthToken(): any;
        getBalances(): any;
        getBuyingPower(): any;
        getDisclosureInfo(): any;
        getDocuments(): any;
        getEmployerInfo(): any;
        getHistoricals(span: any, interval: any): any;
        getInvestmentProfile(): any;
        getLinkedBanks(): any;
        getOptionOrders(): any;
        getOptionPositions(): any;
        getPortfolio(): any;
        getRecentDayTrades(): any;
        getRecentOrders(): any;
        getTaxInfo(): any;
        getUID(): any;
        getUserInfo(): any;
        getUsername(): any;
        isAuthenticated(): any;
        logout(): any;
        reauthenticate(refreshToken: any): any;
        save(): any;
        serialize(): any;
    }
}
**/