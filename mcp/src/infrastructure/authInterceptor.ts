export type FetchFn = (input: string | URL, init?: RequestInit) => Promise<Response>

export function withBearerToken(fetchFn: FetchFn = fetch): FetchFn {
    return (input, init = {}) => {
        const token = process.env.API_TOKEN
        if (!token) {
            throw new Error("API_TOKEN environment variable is not set")
        }

        const headers = new Headers(init.headers)
        headers.set("Authorization", `Bearer ${token}`)

        return fetchFn(input, { ...init, headers })
    }
}
