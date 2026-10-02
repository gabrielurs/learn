/**
 * SVG authoring loop for the svg-maker subagent — three tools that share one
 * session-scoped source file:
 *
 *   write_svg   — write the full SVG source to the session's file
 *   edit_svg    — exact-match old_text→new_text on that file (pi-edit semantics)
 *   render_svg  — render whatever is in the file → PNG, returned inline; with
 *                 `save_as`, also publish it into <cwd>/viz
 *
 * Bundled inside the visual-tools extension and exposed to subagents via the
 * interactive-subagents `registerToolExtension` hook (see ../index.ts). Loaded
 * by the spawned child pi process for any subagent whose `tools:` frontmatter
 * includes these names (currently just svg-maker). All three names map to this
 * one file.
 *
 * Rendering shells out to rsvg-convert (librsvg — good system-font handling),
 * falling back to ImageMagick's `magick` if rsvg-convert is absent. Both are
 * system binaries; no node render deps. Module-level session state persists
 * across this child process's tool calls, isolated from any parallel maker.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { Type } from "@sinclair/typebox"
import {
  applyEdit,
  existsSync,
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

const GROUP = "svg"
const BODY_FILE = "diagram.svg"
const RENDER_TIMEOUT_MS = 60_000

type RenderDetails = { ok: boolean; path: string; filename?: string }

let session: Session | null = null

/** Render an SVG file to PNG via rsvg-convert, falling back to magick. */
async function renderSvg(svgPath: string, outPath: string, workDir: string) {
  // rsvg-convert renders at the SVG's intrinsic size; -z 2 doubles it for crispness.
  // -b white matches the magick fallback: a transparent PNG makes dark strokes
  // vanish when Obsidian uses a dark theme.
  let res = await run("rsvg-convert", ["-z", "2", "-b", "white", svgPath, "-o", outPath], {
    cwd: workDir,
    timeoutMs: RENDER_TIMEOUT_MS,
  })
  if (res.code === 0 && existsSync(outPath)) return { ok: true as const, res }
  // Fallback: ImageMagick. -density 192 (~2x of 96dpi) for a crisp raster.
  const magick = await run("magick", ["-density", "192", "-background", "white", svgPath, outPath], {
    cwd: workDir,
    timeoutMs: RENDER_TIMEOUT_MS,
  })
  if (magick.code === 0 && existsSync(outPath)) return { ok: true as const, res: magick }
  return { ok: false as const, res: res.code !== null ? res : magick }
}

export default function svgToolsExtension(pi: ExtensionAPI) {
  // ── write_svg ──────────────────────────────────────────────────────────────
  pi.registerTool({
    name: "write_svg",
    label: "Write SVG",
    description:
      "Escribe el código SVG COMPLETO en el archivo gestionado de esta sesión (tu " +
      "primer borrador o una reescritura completa). NO das nombre al archivo: " +
      "edit_svg y render_svg actúan sobre el mismo.\n\n" +
      "`source` es un documento `<svg ...>…</svg>` completo con width/height " +
      "explícitos (o viewBox), tamaños de letra legibles y fondo blanco. Escribir " +
      "NO renderiza: llama a render_svg cuando esté listo. Para un arreglo pequeño, " +
      "usa edit_svg en vez de reescribir. Las etiquetas van en castellano.",
    parameters: Type.Object({
      source: Type.String({ description: "El documento SVG completo, de `<svg` a `</svg>`." }),
    }),
    async execute(_id, params) {
      const source = (params.source ?? "").trim()
      if (!source) throw new Error("`write_svg` requiere un `source` no vacío.")
      if (!source.includes("<svg")) throw new Error("`write_svg`: source debe ser un documento <svg>…</svg> completo.")
      session = writeBody(GROUP, BODY_FILE, source)
      const lines = source.split("\n").length
      return {
        content: [
          { type: "text", text: `Escrito código SVG de ${lines} líneas.\nLlama a render_svg para renderizarlo, o a edit_svg para retocarlo.` },
        ],
        details: { ok: true, path: session.bodyPath, lines },
      }
    },
  })

  // ── edit_svg ───────────────────────────────────────────────────────────────
  pi.registerTool({
    name: "edit_svg",
    label: "Edit SVG",
    description:
      "Hace un único reemplazo por coincidencia exacta en el código SVG de esta " +
      "sesión — el mismo contrato que el edit integrado de pi, limitado al archivo " +
      "gestionado. `old_text` debe aparecer EXACTAMENTE UNA VEZ (incluye contexto " +
      "alrededor para que sea único); con 0 o >1 coincidencias la llamada falla y " +
      "no cambia nada. Llama antes a write_svg. Editar NO renderiza.",
    parameters: Type.Object({
      old_text: Type.String({ description: "Fragmento exacto del código actual a reemplazar (debe coincidir una sola vez)." }),
      new_text: Type.String({ description: "Texto que sustituye a `old_text`." }),
    }),
    async execute(_id, params) {
      if (!session || !existsSync(session.bodyPath)) {
        throw new Error("edit_svg: aún no hay código — llama antes a write_svg.")
      }
      const current = readFileSync(session.bodyPath, "utf8")
      const { updated, index } = applyEdit(current, String(params.old_text ?? ""), String(params.new_text ?? ""))
      writeFileSync(session.bodyPath, updated, "utf8")
      return {
        content: [
          { type: "text", text: "Edición aplicada. Zona actualizada:\n```\n" + snippetAround(updated, index) + "\n```\nLlama a render_svg para verla." },
        ],
        details: { ok: true, path: session.bodyPath },
      }
    },
  })

  // ── render_svg ─────────────────────────────────────────────────────────────
  pi.registerTool({
    name: "render_svg",
    label: "Render SVG",
    description:
      "Renderiza a PNG el código SVG ACTUAL de la sesión y lo devuelve en línea " +
      "para que VEAS la imagen e iteres. Aquí NO pasas el código: sale del archivo " +
      "gestionado; llama antes a write_svg.\n\n" +
      "Itera libremente sin `save_as` (solo vista previa). Cuando la imagen sea " +
      "correcta y limpia, llama una vez más con `save_as` = un slug corto en " +
      "kebab-case: eso publica el PNG en <cwd>/viz con un nombre único y devuelve " +
      "el nombre de archivo a incrustar. Si falla el renderizado, devuelve el texto " +
      "del error en vez de una imagen — corrige con edit_svg y vuelve a renderizar.",
    parameters: Type.Object({
      save_as: Type.Optional(
        Type.String({
          description:
            "Slug corto del tema en kebab-case (p. ej. 'recta-numerica'). Si se " +
            "indica, el PNG se publica en <cwd>/viz como viz-<slug>-<timestamp>.png " +
            "y se devuelve el nombre. Omítelo para una vista previa.",
        }),
      ),
    }),
    async execute(_id, params) {
      if (!session || !existsSync(session.bodyPath)) {
        throw new Error("render_svg: aún no hay código — llama antes a write_svg.")
      }
      const { workDir, bodyPath } = session
      mkdirSync(workDir, { recursive: true })
      pruneRenders(workDir)

      const outPath = join(workDir, `render-${Date.now()}.png`)
      const { ok, res } = await renderSvg(bodyPath, outPath, workDir)

      if (!ok) {
        const detail = (res.stderr || res.stdout || "unknown error").split("\n").slice(-30).join("\n")
        const note = res.timedOut ? "El renderizado SVG superó el tiempo límite.\n\n" : ""
        return {
          content: [
            {
              type: "text",
              text: `${note}El renderizado SVG FALLÓ — no se generó imagen (se probó rsvg-convert y luego magick). Corrige el código con edit_svg y vuelve a llamar a render_svg. Si ninguno está instalado: brew install librsvg.\n\nError:\n${detail}`,
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
          text: `Publicado en viz/.\nfilename: ${filename}\npath: ${path}\n\nMIRA la imagen de abajo para confirmar que la geometría es correcta antes de devolverla.`,
        })
        content.push({ type: "image", data, mimeType: "image/png" })
        return { content, details: { ok: true, path, filename } as RenderDetails }
      }

      content.push({
        type: "text",
        text: "Vista previa (aún sin guardar). MIRA: ¿coordenadas, ángulos, direcciones y proporciones correctas? ¿Etiquetas claras y sin recortar? Corrige con edit_svg, o vuelve a renderizar con `save_as` para publicar.",
      })
      content.push({ type: "image", data, mimeType: "image/png" })
      return { content, details: { ok: true, path: outPath } as RenderDetails }
    },
  })
}
