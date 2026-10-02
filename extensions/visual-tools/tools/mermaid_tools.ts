/**
 * Mermaid authoring loop for the mermaid-maker subagent — three tools that
 * share one session-scoped source file:
 *
 *   write_mermaid   — write the full Mermaid source to the session's file
 *   edit_mermaid    — exact-match old_text→new_text on that file (pi-edit semantics)
 *   render_mermaid  — render whatever is in the file → PNG, returned inline;
 *                     with `save_as`, also publish it into <cwd>/viz
 *
 * Bundled inside the visual-tools extension and exposed to subagents via the
 * interactive-subagents `registerToolExtension` hook (see ../index.ts). NOT a
 * global pi extension — loaded by the spawned child pi process for any subagent
 * whose `tools:` frontmatter includes these names (currently just
 * mermaid-maker). All three names map to this one file.
 *
 * Rendering shells out to the bundled @mermaid-js/mermaid-cli (`mmdc`) with a
 * puppeteer config pointing at an installed Chrome, so no Chromium download is
 * needed. Module-level session state persists across this child process's tool
 * calls and is naturally isolated from any parallel maker (different process).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { Type } from "@sinclair/typebox"
import { fileURLToPath } from "node:url"
import {
  applyEdit,
  dirname,
  existsSync,
  findChrome,
  join,
  mkdirSync,
  publish,
  pruneRenders,
  readFileSync,
  run,
  type Session,
  snippetAround,
  writeBody,
  writeFileSync,
} from "./_common.ts"

const TOOL_DIR = dirname(fileURLToPath(import.meta.url))
const EXTENSION_DIR = dirname(TOOL_DIR)
const MMDC_BIN = join(EXTENSION_DIR, "node_modules", ".bin", "mmdc")
const GROUP = "mermaid"
const BODY_FILE = "diagram.mmd"
const RENDER_TIMEOUT_MS = 120_000

type RenderDetails = { ok: boolean; path: string; filename?: string }

let session: Session | null = null

export default function mermaidToolsExtension(pi: ExtensionAPI) {
  // ── write_mermaid ──────────────────────────────────────────────────────────
  pi.registerTool({
    name: "write_mermaid",
    label: "Write Mermaid",
    description:
      "Escribe el código Mermaid COMPLETO en el archivo gestionado de esta sesión " +
      "(tu primer borrador o una reescritura completa). NO das nombre al archivo: " +
      "edit_mermaid y render_mermaid actúan sobre el mismo.\n\n" +
      "`source` es un diagrama Mermaid completo, p. ej. un flujo `graph TD` / " +
      "`graph LR`, `sequenceDiagram`, `stateDiagram-v2`, `erDiagram`, " +
      "`classDiagram`, `mindmap` o `timeline`. Escribir NO renderiza: llama a " +
      "render_mermaid cuando esté listo. Para un arreglo pequeño, usa edit_mermaid " +
      "en vez de reescribir. Las etiquetas van en castellano.",
    parameters: Type.Object({
      source: Type.String({
        description: "El código Mermaid completo del diagrama (empieza por el tipo, p. ej. `graph TD`).",
      }),
    }),
    async execute(_id, params) {
      const source = (params.source ?? "").trim()
      if (!source) throw new Error("`write_mermaid` requiere un `source` no vacío.")
      session = writeBody(GROUP, BODY_FILE, source)
      const lines = source.split("\n").length
      return {
        content: [
          {
            type: "text",
            text: `Escrito código Mermaid de ${lines} líneas.\nLlama a render_mermaid para renderizarlo, o a edit_mermaid para retocarlo.`,
          },
        ],
        details: { ok: true, path: session.bodyPath, lines },
      }
    },
  })

  // ── edit_mermaid ───────────────────────────────────────────────────────────
  pi.registerTool({
    name: "edit_mermaid",
    label: "Edit Mermaid",
    description:
      "Hace un único reemplazo por coincidencia exacta en el código Mermaid de " +
      "esta sesión — el mismo contrato que el edit integrado de pi, limitado al " +
      "archivo gestionado. `old_text` debe aparecer EXACTAMENTE UNA VEZ (incluye " +
      "contexto alrededor para que sea único); con 0 o >1 coincidencias la llamada " +
      "falla y no cambia nada. Llama antes a write_mermaid. Editar NO renderiza.",
    parameters: Type.Object({
      old_text: Type.String({ description: "Fragmento exacto del código actual a reemplazar (debe coincidir una sola vez)." }),
      new_text: Type.String({ description: "Texto que sustituye a `old_text`." }),
    }),
    async execute(_id, params) {
      if (!session || !existsSync(session.bodyPath)) {
        throw new Error("edit_mermaid: aún no hay código — llama antes a write_mermaid.")
      }
      const current = readFileSync(session.bodyPath, "utf8")
      const { updated, index } = applyEdit(current, String(params.old_text ?? ""), String(params.new_text ?? ""))
      writeFileSync(session.bodyPath, updated, "utf8")
      return {
        content: [
          { type: "text", text: "Edición aplicada. Zona actualizada:\n```\n" + snippetAround(updated, index) + "\n```\nLlama a render_mermaid para verla." },
        ],
        details: { ok: true, path: session.bodyPath },
      }
    },
  })

  // ── render_mermaid ─────────────────────────────────────────────────────────
  pi.registerTool({
    name: "render_mermaid",
    label: "Render Mermaid",
    description:
      "Renderiza a PNG el código Mermaid ACTUAL de la sesión y lo devuelve en línea " +
      "para que VEAS el diagrama e iteres. Aquí NO pasas el código: sale del " +
      "archivo gestionado; llama antes a write_mermaid.\n\n" +
      "Itera libremente sin `save_as` (solo vista previa). Cuando el diagrama sea " +
      "correcto y limpio, llama una vez más con `save_as` = un slug corto en " +
      "kebab-case: eso publica el PNG en <cwd>/viz con un nombre único y devuelve " +
      "el nombre de archivo a incrustar. Si falla el renderizado, devuelve el texto " +
      "del error en vez de una imagen — corrige con edit_mermaid y vuelve a renderizar.",
    parameters: Type.Object({
      save_as: Type.Optional(
        Type.String({
          description:
            "Slug corto del tema en kebab-case (p. ej. 'paquetes-internet'). Si se " +
            "indica, el PNG se publica en <cwd>/viz como viz-<slug>-<timestamp>.png " +
            "y se devuelve el nombre. Omítelo para una vista previa.",
        }),
      ),
    }),
    async execute(_id, params) {
      if (!session || !existsSync(session.bodyPath)) {
        throw new Error("render_mermaid: aún no hay código — llama antes a write_mermaid.")
      }
      const { workDir, bodyPath } = session
      mkdirSync(workDir, { recursive: true })
      pruneRenders(workDir)

      const chrome = findChrome()
      const cfgPath = join(workDir, "puppeteer.json")
      writeFileSync(
        cfgPath,
        JSON.stringify(chrome ? { executablePath: chrome, args: ["--no-sandbox"] } : { args: ["--no-sandbox"] }),
        "utf8",
      )

      const outPath = join(workDir, `render-${Date.now()}.png`)
      const res = await run(
        MMDC_BIN,
        ["-i", bodyPath, "-o", outPath, "-p", cfgPath, "-s", "2", "-b", "white"],
        { cwd: workDir, timeoutMs: RENDER_TIMEOUT_MS, env: { PUPPETEER_SKIP_DOWNLOAD: "1" } },
      )

      if (res.code !== 0 || !existsSync(outPath)) {
        const detail = (res.stderr || res.stdout || "unknown error").split("\n").slice(-30).join("\n")
        const note = res.timedOut ? "mmdc superó el tiempo límite.\n\n" : ""
        const hint = chrome
          ? ""
          : "\n\nNo se encontró Chrome/Chromium instalado. Instala Google Chrome o define PUPPETEER_EXECUTABLE_PATH."
        return {
          content: [
            {
              type: "text",
              text: `${note}El renderizado Mermaid FALLÓ — no se generó imagen. Corrige el código con edit_mermaid y vuelve a llamar a render_mermaid.\n\nError:\n${detail}${hint}`,
            },
          ],
          details: { ok: false, path: "" } as RenderDetails,
        }
      }

      const data = readFileSync(outPath).toString("base64")
      const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = []

      if (params.save_as) {
        const { filename, path } = publish(outPath, String(params.save_as))
        content.push({
          type: "text",
          text: `Publicado en viz/.\nfilename: ${filename}\npath: ${path}\n\nMIRA el diagrama de abajo para confirmar que es correcto antes de devolverlo.`,
        })
        content.push({ type: "image", data, mimeType: "image/png" })
        return { content, details: { ok: true, path, filename } as RenderDetails }
      }

      content.push({
        type: "text",
        text: "Vista previa (aún sin guardar). MIRA: ¿flechas/relaciones correctas, etiquetas bien, nada apretado? Corrige con edit_mermaid, o vuelve a renderizar con `save_as` para publicar.",
      })
      content.push({ type: "image", data, mimeType: "image/png" })
      return { content, details: { ok: true, path: outPath } as RenderDetails }
    },
  })
}
