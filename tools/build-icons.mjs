// Makes the PNG app icons from icons/icon-full.svg with a local Chrome (headless screenshots).
// Phones need PNGs for the home-screen icon. Run again only if the icon design changes:
//
//   node tools/build-icons.mjs
//
// Set CHROME_PATH if Chrome isn't in the usual Windows location.

import { execFileSync } from "node:child_process"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { existsSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const chrome = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find(existsSync)
if (!chrome) {
    console.error("Chrome not found. Set CHROME_PATH to chrome.exe.")
    process.exit(1)
}

const SIZES = { "apple-touch-icon.png": 180, "icon-192.png": 192, "icon-512.png": 512 }
const tmp = await mkdtemp(path.join(os.tmpdir(), "ot-icons-"))
const svgUrl = pathToFileURL(path.join(root, "icons", "icon-full.svg")).href
try {
    for (const [name, size] of Object.entries(SIZES)) {
        const page = path.join(tmp, `${size}.html`)
        await writeFile(page, `<!doctype html><html><body style="margin:0;overflow:hidden"><img src="${svgUrl}" width="${size}" height="${size}" style="display:block"></body></html>`)
        execFileSync(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--user-data-dir=${path.join(tmp, "profile")}`,
            `--window-size=${size},${size}`, `--screenshot=${path.join(root, "icons", name)}`, pathToFileURL(page).href], { stdio: "ignore" })
        console.log(`icons/${name} (${size}x${size})`)
    }
} finally {
    await rm(tmp, { recursive: true, force: true })
}
