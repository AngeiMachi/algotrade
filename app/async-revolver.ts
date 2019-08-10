import moment from "moment-timezone";

export class AsyncRevolver {
    private _bullets: any[];
    private _intervalTime: number;
    private _groupInterval: boolean;
    private _includeFirstRound: boolean;

    private _didMakeFirstRound: boolean = false;
    private _bulletsTimer: number[] = [];
    private _index: number = 0;

    constructor(
        bullets: any[] | { [key: string]: any },
        intervalTime: number = 0,
        includeFirstRound = false,
        groupInterval: boolean = true,
    ) {
        const tmpBullets =
            bullets instanceof Object && !(bullets instanceof Array)
                ? Object.keys(bullets).map(key => bullets[key])
                : bullets;

        if (tmpBullets.length === 0 || intervalTime < 0) {
            throw 'Invalid init';
        }

        this._bullets = tmpBullets;
        this._intervalTime = intervalTime;
        this._groupInterval = groupInterval;
        this._includeFirstRound = includeFirstRound;

        const initialInterval = this._includeFirstRound ? 0 : this._intervalTime;

        this._bullets.forEach((asset, index) => {
            if (this._groupInterval ) {
                this._bulletsTimer.push(new Date().getTime() + initialInterval);
            } else {
                this._bulletsTimer.push(new Date().getTime() + (initialInterval * (index + 1)));
            }
        });

        this.printBulletsTimer();
    }

    public next(log?: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const nextBullet = this.getComingBullet();
            this.promoteIndex();
            setTimeout(() => {
                resolve(nextBullet);
            }, this.getComingBulletAwaitTime());
            this.printBulletsTimer();
        });
    }

    private promoteIndex() {
        if (this._index + 1 < this._bullets.length) {
            this._index++;
        } else {
            if (!this._didMakeFirstRound) {
                this._didMakeFirstRound = true;
            }
            this._index = 0;
        }
        return this;
    }

    private getComingBulletAwaitTime(): number {
        const now = new Date().getTime();
        let coming;

        coming = this._bulletsTimer.shift() as number;

        const comingBulletTime = coming - now;

        if (comingBulletTime <= 0) {
            if (this._groupInterval) {
                this._bulletsTimer.push(now + this._intervalTime);
            } else {
                const lastIntervalTime = this._bulletsTimer[this._bulletsTimer.length - 1];
                this._bulletsTimer.push(lastIntervalTime + this._intervalTime);
            }
            return 0;
        }

        if (this._groupInterval) {
            this._bulletsTimer.push(now + this._intervalTime + comingBulletTime);
        } else {
            const lastIntervalTime = this._bulletsTimer[this._bulletsTimer.length - 1];
            this._bulletsTimer.push(lastIntervalTime + this._intervalTime);
        }
        return comingBulletTime;
    }

    private getComingBullet() {
        return this._bullets[this._index];
    }

    private printBulletsTimer() {
        console.log(new Date() + ": ["+
                        moment(this._bulletsTimer[0]).format("HH:mm:ss")+","+
                        moment(this._bulletsTimer[1]).format("HH:mm:ss")+","+
                        moment(this._bulletsTimer[2]).format("HH:mm:ss")+","+
                        moment(this._bulletsTimer[3]).format("HH:mm:ss")+","+
                        moment(this._bulletsTimer[4]).format("HH:mm:ss")+","+
                        moment(this._bulletsTimer[5]).format("HH:mm:ss")+"]"
                    );
    }
}
