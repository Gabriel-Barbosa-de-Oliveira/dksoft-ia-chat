// FIFO mutual exclusion per key (single process)
export type ConversationLock = { acquire(key: string): Promise<() => void> }

export function createConversationLock(): ConversationLock {
    const tails = new Map<string, Promise<void>>()
    return {
        async acquire(key) {
            const prev = tails.get(key) ?? Promise.resolve()
            let release!: () => void
            const mine = new Promise<void>((r) => { release = r })
            const tail = prev.then(() => mine)
            tails.set(key, tail)
            await prev
            let released = false
            return () => {
                if (released) return
                released = true
                release()
                if (tails.get(key) === tail) tails.delete(key)
            }
        },
    }
}
