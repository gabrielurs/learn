---
name: visualize
description: "Añade a una lección un visual correcto y mínimo — un diagrama o figura geométrica — que se renderiza en línea en el log de Obsidian. Úsalo cuando una idea sea de verdad más clara como imagen: un grafo de dependencias, sistema/flujo, secuencia, máquina de estados, árbol, comparación, o algo espacial/geométrico (geometría analítica, recta numérica, vectores, una gráfica, una disposición física). Delega la autoría y el renderizado en un subagente creador que verifica la imagen mirándola; después incrustas el archivo devuelto."
---

# Visualizar

Una imagen solo se gana su sitio cuando muestra algo que las palabras no pueden — forma, estructura, dirección, relación, geometría. Este skill produce UNA imagen así, garantiza que es **correcta** (el creador la renderiza y la mira antes de devolverla) y la mete en la lección para que se renderice en línea en el archivo `md-log` de Obsidian.

Tú eres la **dirección creativa**. Decides la idea exacta y la destilas a los mínimos elementos que la sostienen. Un **subagente creador** hace la autoría, el renderizado, la verificación visual y el guardado, y devuelve un nombre de archivo. Tú incrustas ese nombre en tu respuesta.

## Cuándo visualizar (y cuándo no)

Este sistema de enseñanza construye un **grafo de dependencias en la cabeza de quien aprende** — verdades incondicionales en la raíz, datos derivados colgando de ellas. Un visual es potente justo cuando hace visible esa estructura (o una geometría). Recurre a uno cuando:

- La idea es una **estructura o relación**: dependencias, un sistema con partes y flechas, un flujo/pipeline, una secuencia de intercambios, una máquina de estados, un árbol/jerarquía, una comparación, una contención (qué está dentro vs fuera).
- La idea es **espacial o geométrica**: geometría analítica, una recta numérica, vectores, la forma de una función, una disposición física.

NO visualices cuando la prosa o una sola ecuación ya lo transmite. Un diagrama decorativo que solo repite la frase de al lado añade ruido y una ocasión de equivocarse. Ante la duda, no — un visual que falta es más barato que uno falso.

## Elige el creador

Dos creadores, descubiertos en `.pi/agents/`:

- **`mermaid-maker`** — visuales estructurales/relacionales: grafos de dependencias, diagramas de flujo, de secuencia/estados/ER/clases, árboles, mapas mentales, líneas de tiempo. Es el de por defecto y encaja directamente con la pedagogía del grafo de dependencias.
- **`svg-maker`** — visuales espaciales/geométricos que Mermaid no sabe maquetar: coordenadas exactas, figuras geométricas, rectas numéricas, vectores, gráficas, formas a medida.

Regla práctica: si son *nodos y aristas / relaciones*, mermaid-maker. Si son *posiciones y formas / geometría*, svg-maker.

## Briefing al creador: una idea, mínimos elementos

El fallo más común es **abarrotar** — cada etiqueta extra hace la imagen más difícil de leer Y más difícil de maquetar bien. Antes del brief, poda hasta los mínimos elementos que sostienen la idea, y de cada uno pregúntate: *«si lo borro, ¿sigue clara la idea?»* Si sí, bórralo.

Dale al creador el concepto Y los elementos concretos que quieres — ni un tema vago, ni una lista larga. **Escribe el brief en castellano y con las etiquetas exactas en castellano**, que es como deben aparecer en la imagen.

- MAL: «haz un diagrama de cómo funciona TCP»
- BIEN: «graph TD: un nodo 'paquete' arriba; flechas hacia abajo a 'ordenación' y 'retransmisión si se pierde'; ambas flechas bajan a 'flujo fiable'. Sin título. Muestra que la fiabilidad se construye A PARTIR de paquetes, no junto a ellos.»

Mantén la idea intacta pero confía en que el creador componga; si tu brief enumera más de ~5–7 elementos, recórtalo antes.

## Invocar

Lanza el creador con la herramienta `subagent`:

```
subagent(agent="mermaid-maker", task="<tu brief mínimo y concreto>")
```
```
subagent(agent="svg-maker", task="<tu brief mínimo y concreto>")
```

El creador tiene sus propias herramientas (`write_*`/`edit_*`/`render_*`) — escribe el código, lo renderiza a PNG, **mira el PNG e itera hasta que es correcto y limpio**, lo publica en el vault con un nombre único y devuelve:

```
RESULT:
filename: viz-<slug>-<timestamp>.png
path: <cwd>/viz/viz-<slug>-<timestamp>.png
```

Si devuelve `RESULT: NONE`, no pudo hacer una imagen correcta del brief — simplifica o replantea, o decide que el visual no compensa. Nunca escribas a mano ni falsees un visual de lección tú mismo; la corrección depende del bucle renderizar-y-mirar del creador. (La única excepción es el pequeño mapa de dependencias en ```mermaid``` que el skill `teach` presenta al planificar: es un boceto de trabajo, no un visual de lección.)

## Incrustarlo en la lección

Pon la incrustación directamente en tu respuesta, con el wikilink de incrustación de Obsidian usando el **filename** devuelto (no la ruta completa) y un ancho:

```
![[viz-<slug>-<timestamp>.png|500]]
```

Nada más. La extensión `md-log` copia literalmente tu respuesta en el `.md` enlazado, y Obsidian resuelve la incrustación por nombre de archivo en cualquier parte del vault (el creador guarda en la carpeta `viz` del proyecto, que está dentro del vault) — así que se renderiza en línea en la lección automáticamente. `|500` es buen ancho por defecto; más grande para diagramas densos. Presenta el visual con una frase y deja que transmita la idea — no narres cada elemento en prosa.

## Por qué es fiable

- El creador nunca devuelve una imagen que no haya **mirado**, así que «se renderiza bien pero dice algo falso» se caza antes de llegar a quien aprende.
- La incrustación PNG significa que **lo que el creador verificó es idéntico píxel a píxel a lo que se ve** — sin deriva por re-renderizado.
- Los nombres únicos mantienen inequívoca la resolución por nombre de Obsidian.

> Los creadores renderizan mediante la extensión `visual-tools` del proyecto (Mermaid con `@mermaid-js/mermaid-cli` empaquetado + Chrome instalado; SVG con `rsvg-convert`, o ImageMagick como alternativa, siempre sobre fondo blanco). Tú no renderizas nada — solo haces el brief al creador e incrustas el nombre que devuelve.
