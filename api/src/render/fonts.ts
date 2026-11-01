import { fileURLToPath } from "node:url"

const dir = new URL("../../assets/fonts/", import.meta.url)
export const FONT_REGULAR = fileURLToPath(new URL("Archivo-Regular.ttf", dir))
export const FONT_SEMIBOLD = fileURLToPath(new URL("Archivo-SemiBold.ttf", dir))
