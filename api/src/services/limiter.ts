export type Limiter = { run<T>(fn: () => Promise<T>): Promise<T> }

export type LimiterOptions = {
    maxConcurrent: number
    perMinute: number
    now?: () => number
    sleep?: (ms: number) => Promise<void>
}

// FIFO limiter: at most `maxConcurrent` in flight and `perMinute` starts in any sliding 60 s window
export function createLimiter(opts: LimiterOptions): Limiter {
    const now = opts.now ?? Date.now
    const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
    const starts: number[] = []
    let active = 0
    const queue: (() => void)[] = []

    const pump = () => {
        while (active < opts.maxConcurrent && queue.length > 0) {
            active++
            queue.shift()!()
        }
    }

    async function waitForRate(): Promise<void> {
        for (;;) {
            const t = now()
            while (starts.length > 0 && t - starts[0]! >= 60000) starts.shift()
            if (starts.length < opts.perMinute) { starts.push(t); return }
            await sleep(Math.max(1, 60000 - (t - starts[0]!)))
        }
    }

    return {
        async run<T>(fn: () => Promise<T>): Promise<T> {
            await new Promise<void>((resolve) => { queue.push(resolve); pump() })
            try {
                await waitForRate()
                return await fn()
            } finally {
                active--
                pump()
            }
        },
    }
}
