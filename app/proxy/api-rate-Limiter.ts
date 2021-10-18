export class TokenBucketRateLimiter {
    private maxRequests: number;
    private maxRequestWindowMS: number;
    private count: number = 0;
    private resetTimeout: any;

    constructor(maxRequests: number, maxRequestWindowMS: number) {
        this.maxRequests = maxRequests;
        this.maxRequestWindowMS = maxRequestWindowMS;
        this.reset();
    }

    reset() {
        this.count = 0;
        this.resetTimeout = null;
    }

    scheduleReset() {
        // Only the first token in the set triggers the resetTimeout
        if (!this.resetTimeout) {
            this.resetTimeout = setTimeout(() => this.reset(), this.maxRequestWindowMS);
        }
    }

    public async acquireToken(): Promise<any> {
        return new Promise(async (resolve, reject) => {
            if (this.count === this.maxRequests) {
                await sleep(this.maxRequestWindowMS);
                this.scheduleReset();
            }

            this.count++;
            resolve('done');
        });
    }
}

function sleep(milliseconds: number) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
