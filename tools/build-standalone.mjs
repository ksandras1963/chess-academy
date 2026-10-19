// Builds "Opening Trainer.html": the whole app in one file that opens by double-click, with no server.
// The code, styles, piece images and lesson files are all packed inside. Rebuild after any change:
//
//   node tools/build-standalone.mjs
//
// (tools/validate.mjs rebuilds it automatically when the content check passes.)
//
// The packer handles the module syntax this project uses: one-line `import { a, b as c } from "./x.js"`,
// `export const|let|function|async function|class`, and `export { a, b as c }`. It stops with an error
// on anything else, so an unsupported pattern can't slip into the build silently.

import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
export const OUTPUT = "Opening Trainer.html"

const rel = p => path.relative(root, p).split(path.sep).join("/")
const IMPORT_RE = /^\s*import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["'];?\s*$/
const EXPORT_DECL_RE = /^\s*export\s+(?:async\s+function|function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/
const EXPORT_LIST_RE = /^\s*export\s*\{([^}]*)\};?\s*$/

/** Modules in dependency order (each one after everything it imports). */
async function collect(file, order = [], seen = new Set()) {
    if (seen.has(file)) return order
    seen.add(file)
    const lines = (await readFile(file, "utf8")).split(/\r?\n/)
    for (const line of lines) {
        if (!/^\s*import\b/.test(line)) continue
        const m = IMPORT_RE.exec(line)
        if (!m) throw new Error(`${rel(file)}: unsupported import: ${line.trim()}`)
        await collect(path.resolve(path.dirname(file), m[2]), order, seen)
    }
    order.push({ file, lines })
    return order
}

/** One module as a function that returns its exports. */
function wrap({ file, lines }) {
    const exported = []
    const body = lines.map(line => {
        let m = IMPORT_RE.exec(line)
        if (m) {
            const id = rel(path.resolve(path.dirname(file), m[2]))
            const names = m[1].split(",").map(s => s.trim()).filter(Boolean).map(s => s.replace(/\s+as\s+/, ": "))
            return `const { ${names.join(", ")} } = __modules[${JSON.stringify(id)}];`
        }
        m = EXPORT_LIST_RE.exec(line)
        if (m) {
            for (const item of m[1].split(",").map(s => s.trim()).filter(Boolean)) {
                const [local, as] = item.split(/\s+as\s+/)
                exported.push(as ? `${as}: ${local}` : local)
            }
            return ""
        }
        m = EXPORT_DECL_RE.exec(line)
        if (m) {
            exported.push(m[1])
            return line.replace(/export\s+/, "")
        }
        if (/^\s*export\b/.test(line)) throw new Error(`${rel(file)}: unsupported export: ${line.trim()}`)
        return line
    })
    return `__modules[${JSON.stringify(rel(file))}] = (function () {\n"use strict";\n${body.join("\n")}\nreturn { ${exported.join(", ")} };\n})();`
}

const noScriptEnd = s => s.replace(/<\/(script)/gi, "<\\/$1")

const FONT_TYPES = { ".woff2": "font/woff2", ".woff": "font/woff" }

/** Replaces relative font url(...) references in a stylesheet with data: URLs. */
async function inlineFonts(css, cssDir) {
    const refs = [...css.matchAll(/url\(\s*["']?([^"')]+\.(woff2?))["']?\s*\)/g)]
    for (const [whole, ref] of refs) {
        const file = path.resolve(cssDir, ref)
        const data = (await readFile(file)).toString("base64")
        css = css.replace(whole, () => `url("data:${FONT_TYPES[path.extname(file)]};base64,${data}")`)
    }
    return css
}

async function spriteDiv(id, file) {
    const svg = (await readFile(path.join(root, file), "utf8")).replace(/<\?xml[^>]*\?>/, "").trim()
    // Same wrapper cm-chessboard would create itself; it skips loading the sprite when the id exists.
    return `<div id="${id}" style="transform:scale(0);position:absolute" aria-hidden="true">${svg}</div>`
}

export async function buildStandalone() {
    const modules = await collect(path.join(root, "js", "main.js"))
    const bundle = `(function () {\nconst __modules = {};\n${modules.map(wrap).join("\n")}\n})();`

    const catalogText = await readFile(path.join(root, "content", "courses.json"), "utf8")
    const content = { "content/courses.json": catalogText }
    for (const op of JSON.parse(catalogText).openings) {
        for (const c of op.courses) {
            if (c.file) content[c.file] = await readFile(path.join(root, c.file), "utf8")
        }
        if (op.puzzles) content[op.puzzles] = await readFile(path.join(root, op.puzzles), "utf8")
    }
    content["content/opening-stats.json"] = await readFile(path.join(root, "content", "opening-stats.json"), "utf8")

    let html = await readFile(path.join(root, "index.html"), "utf8")
    const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)]
    for (const [tag, href] of links) {
        const cssPath = path.join(root, href)
        const css = await inlineFonts(await readFile(cssPath, "utf8"), path.dirname(cssPath))
        html = html.replace(tag, () => `<style>\n${css.replace(/\/\*# sourceMappingURL=[^*]*\*\//g, "")}\n</style>`)
    }
    const icon = await readFile(path.join(root, "icons", "icon.svg"), "utf8")
    html = html.replace(/<link rel="icon"[^>]*>/, () =>
        `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon.trim())}">`)
    html = html.replace(/<script type="module" src="js\/main\.js"><\/script>\n?/, "")
    // Home-screen install needs a website, so the file version leaves those tags out.
    html = html.replace(/<!-- Installing to a phone's home screen[^>]*-->\n?/, "")
    html = html.replace(/<link rel="(?:manifest|apple-touch-icon)"[^>]*>\n?/g, "")
    html = html.replace(/<meta name="apple-mobile-web-app-[^"]+"[^>]*>\n?/g, "")

    const sprites = [
        await spriteDiv("cm-chessboard-sprite", "vendor/cm-chessboard/assets/pieces/standard.svg"),
        await spriteDiv("cm-chessboard-markers", "vendor/cm-chessboard/assets/extensions/markers/markers.svg"),
        await spriteDiv("cm-chessboard-arrows", "vendor/cm-chessboard/assets/extensions/arrows/arrows.svg")
    ].join("\n")
    const scripts = `${sprites}\n<script>\nwindow.__OT_CONTENT__ = ${noScriptEnd(JSON.stringify(content))};\n</script>\n<script>\n${noScriptEnd(bundle)}\n</script>\n`
    html = html.replace("</body>", () => scripts + "</body>")
    html = html.replace("<!doctype html>", () =>
        `<!doctype html>\n<!-- Built ${new Date().toISOString().slice(0, 10)} by tools/build-standalone.mjs. Don't edit this file: edit the sources and rebuild. -->`)

    await writeFile(path.join(root, OUTPUT), html)
    return { file: OUTPUT, modules: modules.length, contentFiles: Object.keys(content).length - 1, bytes: Buffer.byteLength(html) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const r = await buildStandalone()
    console.log(`Built ${r.file}: ${r.modules} modules, ${r.contentFiles} content files, ${(r.bytes / 1024).toFixed(0)} KB`)
}
