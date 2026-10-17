import { settings } from "./storage.js"

const media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: light)") : null

export function applyTheme() {
    let t = settings().theme
    if (t === "system") t = media && media.matches ? "light" : "dark"
    document.documentElement.dataset.theme = t
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.content = t === "light" ? "#eef1ec" : "#0f1c17"
}

media?.addEventListener?.("change", () => { if (settings().theme === "system") applyTheme() })
