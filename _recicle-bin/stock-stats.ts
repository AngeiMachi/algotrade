//  private ratioPower: number = 0;
//     private percentageChange: number = 0;
//     private isInBreakOutOrDown: BuyDirectionEnum = BuyDirectionEnum.NONE;
//     private volumeChangeIntervalData = {} as IQuoteFullIntervalData;

//     private composeAndPrintSellMessage() {
//     const today = moment().isoWeekday();
//     const nextFridayDate = moment().isoWeekday(today + 5 + (7 - today)).format("MMM Do YY");

//     logger.debug("*** " + this.quote + " *** passed threshold by " + this.ratioPower * 100 + "% at "
//         + moment(this.volumeChangeIntervalData.time).format("HH:mm:ss(MMMM Do YYYY)")
//         + "\n Should Sell " + BuyDirectionEnum[this.isInBuyDirection] + "S of the "
//         + nextFridayDate + "due to opposite direction volume volatility");
// }

//     private isTradeClosingTime(stockInterval: IQuoteFullIntervalData): boolean {
//     return (stockInterval.time.getHours() >= 22 && stockInterval.time.getMinutes() >= 45 || stockInterval.time.getHours() === 23);
// }

//     private getPercentageChange(stockInterval: IQuoteFullIntervalData): number {
//     const percentage = (Math.abs(stockInterval.open - stockInterval.close) / stockInterval.open) * 100;

//     return +percentage.toFixed(2);
// }

//     private getVolumeRatioPower(volume: number): number {
//     const ratio = volume / this.averageVolume;
//     return +ratio.toFixed(2);
// }

//     private getBuyDirection(stockInterval: IQuoteFullIntervalData): BuyDirectionEnum {
//     if (stockInterval.close > stockInterval.open) {
//         // checks if inverted hammer - if so , there is hesitation - don't buy Call
//         // if ((stockInterval.high - stockInterval.close) > (stockInterval.close - stockInterval.open)) {
//         //     return BuyDirectionEnum.NONE;
//         // }
//         return BuyDirectionEnum.CALL;
//     } else if (stockInterval.open > stockInterval.close) {
//         // checks if hammer - if so , there is hesitation - don't buy put 
//         // if ((stockInterval.close - stockInterval.low) > (stockInterval.open - stockInterval.close)) {
//         //     return BuyDirectionEnum.NONE;
//         // }
//         return BuyDirectionEnum.PUT;
//     } else {
//         return BuyDirectionEnum.NONE;
//     }
// }

//     private didPassVolumeThreshold(stockInterval: IQuoteFullIntervalData): boolean {
//     if (this.isTradeClosingTime(stockInterval)) {
//         return false;
//     }

//     const { volume } = stockInterval;
//     if (volume > this.averageVolume * VOLUME_THRESHOLD_ALARM && !this.isInBuyDirection) {
//         const percentageIntervalChange = this.getPercentageChange(stockInterval);
//         if (this.quote === "AMZN" || this.quote === "GOOGL" || this.quote === "CMG") {
//             return true;
//         } else {
//             return (percentageIntervalChange > PERCENTAGE_CHANGE_THRESHOLD);
//         }
//     } else {
//         return false;
//     }
// }
//     private calculateAverageVolume2(stockInterval: IQuoteFullIntervalData) {
//     if (this.interval >= MINIMUM_INTERVALS_TO_CALCULATE_AVERAGE_VOLUME) {
//         this.volumeSum += stockInterval.volume;
//         this.volumeInterval++;
//         this.averageVolume = this.volumeSum / this.volumeInterval;

//         if (this.didPassVolumeThreshold(stockInterval)) {
//             const currentBuyDirection = this.getBuyDirection(stockInterval);
//             const currentRatioPower = this.getVolumeRatioPower(stockInterval.volume);

//             if (!this.isInBuyDirection) {
//                 if (currentBuyDirection !== BuyDirectionEnum.NONE) {
//                     this.isInBuyDirection = currentBuyDirection;
//                     this.volumeChangeIntervalData = { ...stockInterval };
//                     this.ratioPower = currentRatioPower;
//                     this.percentageChange = this.getPercentageChange(stockInterval);
//                 }
//             } else if (this.isInBuyDirection) {
//                 if (currentBuyDirection !== this.isInBuyDirection && currentBuyDirection !== BuyDirectionEnum.NONE) {
//                     this.composeAndPrintSellMessage();
//                 }
//             }
//         }
//     }
// }
//     private composeAndPrintBuyMessageBasedOnHOD() {
//     const today = moment().isoWeekday();
//     const nextFridayDate = moment().isoWeekday(today + 5 + (7 - today)).format("MMM Do YY");

//     const buyMessage = "*** " + this.quote + " Was bought by breakout confirmation "
//         + moment(this.HODIntervalData.time).format("HH:mm:ss(MMMM Do YYYY)")
//         + " Can buy Calls of the " + nextFridayDate;

//     pushed.sendPushMessage(buyMessage);
//     logger.debug(buyMessage);
// }
//     private composeAndPrintBuyMessage(stockInterval: IQuoteFullIntervalData) {
//     if (!this.didBuy && this.isInBreakOutOrDown === this.isInBuyDirection && this.isInBuyDirection !== BuyDirectionEnum.NONE) {
//         this.boughtIntervalData = { ...stockInterval };

//         let breakInterval: IQuoteFullIntervalData = {} as IQuoteFullIntervalData;

//         if (this.isInBreakOutOrDown === BuyDirectionEnum.CALL) {
//             breakInterval = this.HODIntervalData;
//         } else if (this.isInBreakOutOrDown === BuyDirectionEnum.PUT) {
//             breakInterval = this.LODIntervalData;
//         }

//         const today = moment().isoWeekday();
//         const nextFridayDate = moment().isoWeekday(today + 5 + (7 - today)).format("MMM Do YY");

//         // + + "buy "+ BuyDirectionEnum[this.isInBuyDirection] + "S of the " + nextFridayDate +

//         const buyMessage = "*** " + this.quote + " *** Entered Buy " + BuyDirectionEnum[this.isInBuyDirection] +
//             " Mode  at " + moment(stockInterval.time).format("HH:mm:ss") + "\n," +
//             moment(this.volumeChangeIntervalData.time).format("HH:mm:ss(MMMM Do YYYY)")
//             + ")Volume: Power=" + (this.ratioPower * 100).toFixed(2) + "%, Change=" +
//             this.percentageChange + "%" + "\n" + moment(breakInterval.time).format("HH:mm:ss(MMMM Do YYYY)")
//             + ") Break Interval time";

//         pushed.sendPushMessage(buyMessage);
//         logger.debug(buyMessage);

//         this.didBuy = true;
//     }
// }