
import { IQuoteFullIntervalData } from '../models/quote-data.model';
import { MADirectionEnum, SignalGroupType, SignalType, SignalVerificationReasonEnum } from '../models/enums';
import { MaCrosssisng, MaPointing, SignalModel } from '../models/signal.model';
import { Signals } from './signals';

export class TacticalDirectionChangeInitiatedSignal extends Signals { 

    private isTacticalDirectionSignalExists:boolean = false;
    
    public monitor(): SignalModel[] {
        let info='';
        let signals: SignalModel[] = [];

        if (this.quoteStats.intervalCount>0){
            for (let signalInput of this.quoteState.initiatedSignals?.tacticalDirectionChangeSignalInput || []){
                if (!signalInput.isTriggered) {
                    this.isTacticalDirectionSignalExists = true;
                    let conditionCount = 0;
                    for (let maPointing of signalInput.maPointing){
                        if(!this.isMaPointingCorrectly(maPointing)) {
                            return [];
                        } else {
                            conditionCount++;
                        }
                    }
                    for (let maCrosssisng of signalInput.maCrosssisng || []){
                         if(!this.isMaCrossedCorrectly(maCrosssisng)) {
                            return [];
                         } else {
                             conditionCount++;
                         }
                    }                    
                    if (conditionCount===signalInput.maPointing.length + (signalInput.maCrosssisng?.length || 0) ) {
                        signalInput.isTriggered = true;
                        info += signalInput.info+',';
                    }
                }
            }
    
            if (this.quoteState.initiatedSignals?.tacticalDirectionChangeSignalInput.length>0 &&
                this.isTacticalDirectionSignalExists) {
                this.isTacticalDirectionSignalExists = false;
                signals.push({
                    signalGroupType: SignalGroupType.INITIATED,
                    signalType: SignalType.TACTICAL_DIRECTION_CHANGE_INITIATED,
                    signalDescription: SignalVerificationReasonEnum.TACTICAL_DIRECTION_CHANGE_INITIATED+this.composeMetadata(info),
                    interval:this.quoteStats.lastInterval,
                    withNotification:true,
                    isDeveloperMode:false
                });
                info='';
            }   
        } 
        return signals;
    }

    private isMaPointingCorrectly(maPointing: MaPointing): boolean {
        const lastMa = (this.quoteStats.lastInterval["MA"+maPointing.maType as keyof IQuoteFullIntervalData] || 0) as number;
        const prevMa = (this.quoteStats.quoteIntervals[this.quoteStats.intervalCount-2]["MA"+maPointing.maType  as keyof IQuoteFullIntervalData] || 0) as number;
        if (maPointing.direction === MADirectionEnum.UP && lastMa > prevMa && this.quoteStats.lastInterval.close>lastMa ) {
            return true;
        } else if (maPointing.direction === MADirectionEnum.DOWN && lastMa < prevMa && this.quoteStats.lastInterval.close<lastMa ) {
            return true;
        }
        return false;
    }

    private isMaCrossedCorrectly(maCrosssisng: MaCrosssisng): boolean {
        const Ma = (this.quoteStats.lastInterval["MA"+maCrosssisng.maType as keyof IQuoteFullIntervalData] || 0) as number;
        const crossedByMa = (this.quoteStats.lastInterval["MA"+maCrosssisng.crossedBy as keyof IQuoteFullIntervalData] || 0) as number;
        if (maCrosssisng.direction === MADirectionEnum.UP && crossedByMa>Ma && this.quoteStats.lastInterval.close>Ma ) {
            return true;
        } else if (maCrosssisng.direction === MADirectionEnum.DOWN && Ma > crossedByMa && this.quoteStats.lastInterval.close<Ma ) {
            return true;
        }
        return false;
    }

    composeMetadata(info: string): string {
        let metadata = ' -';
        let priorityIndex = new Map();
        let infoArray = info.split(',');
        let infoArrayEnries = infoArray.entries();
        for (let [index,infoItem] of infoArrayEnries) {
            if (infoItem.includes('ABSOLUTE')) {
                priorityIndex.set('ABSOLUTE',index);
            } else if (infoItem.includes('HARD')) {
                priorityIndex.set('HARD',index);
            } else if (infoItem.includes('SOFT')) {
                priorityIndex.set('SOFT',index);
            }
        }

        if (priorityIndex.has('ABSOLUTE')) {
            metadata +=(infoArray[priorityIndex.get('ABSOLUTE')].includes(MADirectionEnum.UP)?'📈':'📉')+' (Absolute)';
        } else if (priorityIndex.has('HARD')) {
            metadata +=(infoArray[priorityIndex.get('HARD')].includes(MADirectionEnum.UP)?'📈':'📉')+' (Hard)';
        } else if (priorityIndex.has('SOFT')) {
            metadata +=(infoArray[priorityIndex.get('SOFT')].includes(MADirectionEnum.UP)?'📈':'📉') +' (Soft)';
        }
        return metadata;
    }
}
