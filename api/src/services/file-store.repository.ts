import type { StoredFile } from "../domain/file-descriptor.ts"

export interface FileStore {
    save(file: StoredFile): void
    get(conversationId: string, fileId: string): StoredFile | undefined
    names(conversationId: string): string[]
    sweep(): void
}
