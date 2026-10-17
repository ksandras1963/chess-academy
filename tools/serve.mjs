// Local preview server with correct MIME types for ES modules. Usage: node tools/serve.mjs [port]
import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const port = Number(process.argv[2] || 8765)
const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".pgn": "text/plain; charset=utf-8",
    ".md": "text/plain; charset=utf-8"
}

createServer(async (req, res) => {
    try {
        let rel = decodeURIComponent(new URL(req.url, "http://x").pathname)
        if (rel.endsWith("/")) rel += "index.html"
        const file = path.join(root, rel)
        if (!file.startsWith(root) || rel.includes("/.git")) throw new Error("forbidden")
        const info = await stat(file)
        if (!info.isFile()) throw new Error("not a file")
        res.writeHead(200, {
            "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream",
            "Cache-Control": "no-cache"
        })
        res.end(await readFile(file))
    } catch {
        res.writeHead(404, { "Content-Type": "text/plain" })
        res.end("Not found")
    }
}).listen(port, "127.0.0.1", () => console.log(`Opening Trainer at http://127.0.0.1:${port}/`))
