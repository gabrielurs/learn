# learn (en castellano)

[![video](assets/thumbnail.png)](https://www.youtube.com/watch?v=kzcI5F4tGiU)

Fork de [amosblomqvist/learn](https://github.com/amosblomqvist/learn), el sistema de aprendizaje con IA del vídeo [How I Use AI to Learn Things](https://www.youtube.com/watch?v=kzcI5F4tGiU), con los errores corregidos y adaptado al castellano.

Es una configuración de [pi](https://github.com/earendil-works/pi): la filosofía de enseñanza codificada en un skill, unas cuantas extensiones pequeñas y definiciones de agentes.

## Qué incluye

- `skills/teach/` — la filosofía y el proceso de enseñanza
- `skills/visualize/` — añade un diagrama correcto y mínimo a una lección cuando una idea se entiende mejor como imagen
- `extensions/ask-user-question.ts` — el agente te hace preguntas mediante un popup
- `extensions/quiz.ts` — preguntas calificadas con feedback instantáneo (✓/✗, respuesta correcta, explicación)
- `extensions/md-log.ts` — enlaza un archivo markdown a la sesión (para leerla renderizada en Obsidian)
- `extensions/visual-tools/` — herramientas para los subagentes de visualización
- `extensions/_shared/` — utilidades compartidas por `quiz` y `ask-user-question` (no es una extensión)
- `agents/` — `researcher`, `svg-maker`, `mermaid-maker`: los subagentes en los que delega el sistema

## Instalación

Este repo **es** un directorio `.pi`. Desde la raíz de tu proyecto de aprendizaje (idealmente, tu vault de Obsidian):

```bash
git clone https://github.com/gabrielurs/learn .pi
cd .pi/extensions/visual-tools && npm install
```

El `npm install` es necesario: instala `mmdc` (mermaid-cli), sin el cual `render_mermaid` no funciona.

Luego abre pi en ese directorio. (O copia las piezas que quieras a la configuración de tu proyecto.)

## Requisitos

- [pi](https://github.com/earendil-works/pi) ≥ 1.0
- Un proveedor con acceso a `anthropic/claude-sonnet-5`, que usan los tres agentes. Cambia `model:` en `agents/*.md` si usas otro.
- Una implementación de subagentes, para que el sistema pueda lanzar el researcher y los creadores de visuales. Recomendada: [pi-interactive-subagents](https://github.com/amosblomqvist/pi-interactive-subagents) (solo tmux). Con ella todo funciona de serie. Cualquier otra sirve, pero tendrás que adaptar las definiciones de agentes; p. ej. `agents/researcher.md` incluye `safe_bash` en sus herramientas, que es propia de esa extensión.
- Para los visuales:
  - Mermaid: Google Chrome o Chromium instalado (o `PUPPETEER_EXECUTABLE_PATH` apuntando a uno).
  - SVG: `rsvg-convert` (`brew install librsvg` en macOS, `apt install librsvg2-bin` en Debian/Ubuntu) o ImageMagick como alternativa.
- `ask-user-question`: usa la copia incluida aquí. Si tu configuración ya tiene una extensión `ask-user-question`, usa **esta** en su lugar. Los popups de distintas extensiones se serializan mediante un bloqueo de UI compartido, que solo funciona si es la misma implementación.

## Uso

1. Crea una nota vacía en tu vault (p. ej. `sesiones/redes.md`) y enlázala: `/md-log sesiones/redes.md`. Si la nota ya tiene contenido, la sesión se añade al final y no se borra nada.
2. Pide lo que quieras aprender. El skill `teach` sondea tu nivel con `quiz`, pregunta tu objetivo, presenta un plan con un mapa de dependencias y enseña nodo a nodo.
3. Lee la sesión renderizada en Obsidian (LaTeX, mermaid e imágenes incluidos).

## Notas

Puedes usar el sistema sin subagentes; la sesión principal se encarga de enseñar. Solo pierdes el researcher (verificación de datos) y los visuales generados.

El skill de enseñanza está escrito para una sola persona. Edítalo para adaptarlo a cómo aprendes tú mejor.

## Cambios respecto al original

**Correcciones**

- `visual-tools`: `package.json` y el lockfile apuntaban a una ruta local de la máquina del autor (`file:/Users/amos/...`), así que `npm install` fallaba en cualquier otra. Ahora es una dependencia normal de npm.
- `md-log`: al enlazar una nota existente, el volcado del historial **sobrescribía** su contenido. Ahora se añade al final. Además, cada anotación se añade con `appendFileSync` en vez de leer y reescribir el archivo entero.
- `svg_tools`: `rsvg-convert` generaba PNG transparentes, ilegibles en el tema oscuro de Obsidian. Ahora el fondo es blanco, igual que con el renderizador alternativo.
- `quiz`: el evento con las opciones barajadas se emitía antes de validar la llamada, así que un quiz inválido dejaba una pregunta suelta en el log. Ahora se valida antes.
- `quiz` y `ask-user-question`: `renderCall` podía lanzar una excepción con argumentos parciales mientras el modelo aún los está generando. Ahora es tolerante.
- `quiz`: la ayuda de selección múltiple decía «Enter envía», pero Enter marca la opción salvo sobre «Enviar».
- `visual-tools`: se borran las vistas previas temporales y se buscan Chrome/Chromium también en Linux.
- Imports unificados en `@earendil-works/*` (pi 1.0 aún acepta los alias `@mariozechner/*`), y código duplicado extraído a `extensions/_shared/ui.ts`.
- Prompts: se resuelve la contradicción entre `teach` (mapa mermaid a mano en el plan) y `visualize` («nunca escribas un diagrama a mano»), y se usa la terminología «verdad incondicional» de forma coherente.
- `researcher` usa `anthropic/claude-sonnet-5` en vez de un modelo de OpenRouter no documentado.

**Castellano**

- Skills, agentes, descripciones de herramientas y toda la UI (popups, log de Obsidian, avisos) traducidos.
- El skill `teach` exige enseñar en castellano y fija criterios de terminología y de coma decimal; los creadores de visuales etiquetan en castellano; el researcher busca también en inglés pero informa en castellano.

## Licencia

El repositorio original no declara licencia. Este fork existe para uso personal; consulta al autor original antes de redistribuirlo.
