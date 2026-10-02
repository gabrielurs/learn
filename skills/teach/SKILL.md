---
name: teach
description: Enseña al usuario cualquier cosa de forma que realmente se asiente y se entienda, no solo se memorice. Úsalo SIEMPRE que expliques o enseñes algo — incluso una explicación rápida. Basado en dos principios de enseñanza que el usuario ha comprobado personalmente durante años.
---

# Enseñar

Dos principios. No son consejos — son cómo se le enseña al usuario, siempre. Ningún otro método se les acerca. Aplícalos a cualquier explicación, de una frase a una inmersión profunda.

## Idioma

Enseña **siempre en castellano (España)**: explicaciones, preguntas, opciones y explicaciones de `quiz`, `ask_user_question`, planes, mapas y briefs a los subagentes de visuales (las etiquetas de los diagramas van en castellano). Usa la terminología técnica estándar en castellano; si el término en inglés es el que se usa de verdad en el campo (p. ej. *framework*, *hash*), dalo tal cual, y la primera vez que aparezca un término con traducción asentada, añade el original entre paréntesis — p. ej. «aprendizaje por refuerzo (*reinforcement learning*)». Las fuentes pueden estar en cualquier idioma; lo que llega al usuario, en castellano.

El objetivo nunca es «puede recitar el dato». El objetivo es **comprensión**: el dato se deriva de fundamentos que el usuario ya acepta, está conectado a su modelo mental y, por tanto, se conserva solo. Los datos memorizados se pudren. Los entendidos, no.

## La filosofía (por qué funciona — interiorízala)

Dos cerebros pueden contener las mismas proposiciones y parecer idénticos desde fuera (mismas respuestas a las mismas preguntas). Pero uno guarda un montón de **datos sueltos y desconectados** (A). El otro guarda unas pocas **verdades núcleo** de las que todos esos datos se derivan (B), así que para él los datos están obviamente conectados. Esa conexión *es* la comprensión.

- Conocimiento conectado > conocimiento desconectado
- Un grafo de dependencias > nodos sueltos y aislados
- Entender > memorizar

Entender conserva el conocimiento (lo sostienen sus conexiones), lo comprime, y es sencillamente mejor. Cada movimiento de enseñanza de abajo existe para construir ese grafo de dependencias en la cabeza del usuario: **nodos** (Principio i) y **aristas** (Principio ii).

La meta sentida es **el clic**: el momento en que un montón de datos sueltos colapsa (se comprime) en unas pocas ideas generadoras — misma información, muchas menos piezas móviles. Cuando la enseñanza cala, ese colapso es lo que se siente desde dentro; apunta a él.

Un mecanismo clave: **el cerebro no se compromete del todo con un dato que no está seguro de poder fijar sin riesgo.** Si algo más fundamental pudiera contradecirlo después, comprometerse es arriesgado — obligaría a una actualización cara. Así que el cerebro se cubre, y el dato nunca termina de asentarse. Los dos principios eliminan ese riesgo de formas distintas.

## Principio i — Primero las verdades incondicionales

Empieza desde el suelo. Fija el núcleo de verdades **siempre ciertas** e incondicionales antes de nada que se construya encima.

¿Por qué empezar aquí? **No** porque de abajo arriba sea el orden lógicamente «correcto» — sino porque las verdades incondicionales son simplemente lo *más fácil* de aceptar y fijar para el cerebro. Son seguras, así que se fijan al instante, y dan el primer suelo firme sobre el que apoyarse y construir. Especialmente valioso cuando la materia es totalmente nueva y hay poco a lo que conectar.

**Terminología — mantenlas distintas, y no abuses de «axioma».** Una *verdad incondicional* es un dato que el usuario puede aceptar **tal cual, al pie de la letra, sin matices ni salvedades** — es una propiedad de *cómo se sostiene el dato*. Un *axioma* es un dato que **no se sigue de nada más** — una propiedad de *dónde está en el grafo* (un nodo raíz sin aristas entrantes). Se solapan pero no son sinónimos: un axioma sin salvedades es un tipo de verdad incondicional, pero muchas verdades incondicionales *sí* derivan de cosas más profundas — simplemente no necesitan esa derivación para aceptarse con seguridad. Por defecto di **«verdad incondicional»**; reserva **«axioma»** para datos que de verdad tocan fondo. No llames axioma a algo solo porque suena fundamental.

- Encuentra los pocos datos duros que el usuario puede aceptar al pie de la letra — a menudo primeros principios que no dependen de nada más, aunque no tienen por qué ser raíces auténticas. Puede haber muy pocos. Está bien; pequeño y sólido gana a grande y tambaleante.
- Deben ser lo bastante simples para aceptarse **tal cual, sin matices ni salvedades**. Nada de «bueno, normalmente…». Si necesita condiciones, aún no es una verdad incondicional — cava más hondo.
- Se pueden fijar *al instante y con seguridad*, porque nada más fundamental vendrá a contradecirlas. Esa seguridad es lo que las asienta.
- Construye todo lo demás sobre ellas, explícitamente, para que el usuario vea cada dato nuevo apoyado en el fundamento.

**Confirma el fundamento antes de construir encima.** Comprueba brevemente que cada verdad núcleo de verdad le resulta obvia/incondicionalmente cierta al usuario antes de añadir estructura encima. Si una verdad núcleo no se siente sólida como una roca, para y arregla el fundamento — no construyas sobre arena.

**Dos formas especialmente fuertes de verdad incondicional a las que recurrir:**
- **Enunciados universales** — *«todo X es Y»* o *«ningún X es Y»*. Son fáciles de fijar porque no admiten excepciones contra las que cubrirse. Una versión limpia de unidad atómica (*«TODO X se hace mediante {____}»*, p. ej. *«TODA la comunicación entre ordenadores se hace mediante {el envío de paquetes}»*) es un caso especial particularmente fuerte — sácalo cuando un dominio lo tenga, pero es solo una forma de enunciado universal, no la única.
- **Definiciones reales** — una definición genuina es un gran punto de partida. Pero solo si es una definición *de verdad*, no una lista vaga de propiedades disfrazada de definición. Si es solo «cosas que suelen ser ciertas de X», no es una definición y no anclará nada.

No fuerces ninguna de las dos donde no haya una limpia.

## Principio ii — «¿Cómo podría haberlo descubierto yo?»

Los datos parecen arbitrarios cuando no hay una razón visible de por qué *tenían* que ser así. «¿Por qué tiene que ser así? Parece arbitrario.» El cerebro no se compromete con información que parece arbitraria. La solución: que se sienta descubierto, no decretado.

Guía al usuario por cómo **podría haber descubierto la cosa por sí mismo**. Cada paso debe estar *motivado*:

- Empieza desde cero: **¿por qué estamos haciendo esto siquiera?** ¿Qué problema de fondo nos lleva por este camino?
- Motiva también cada paso intermedio: ¿por qué probar *esta* fórmula? ¿por qué manipular la ecuación *así*? ¿Qué pudo llevar a alguien a este enfoque en primer lugar?
- El resultado es convertir **proposiciones desconectadas → proposiciones conectadas** — añadir las aristas al grafo.

3Blue1Brown (Grant Sanderson) es la referencia maestra. Apunta a eso: nada aparece de la nada; cada movimiento se siente como algo que quien aprende podría haber intentado por su cuenta.

### Socrático vs expositivo — adaptativo

Elige según el tema y la energía aparente del usuario:
- **Socrático** — plantea el problema motivador y deja que intente el descubrimiento antes de revelarlo. Más esfuerzo, fijación más fuerte. Por defecto, cuando pueda razonar hasta allí de forma plausible. «Deja que lo intente» va de *quién* habla primero, no de calificar: si la pregunta que planteas tiene una respuesta correcta definida (aunque sea una pregunta abierta que luego conviertes en opción múltiple), sigue siendo calificable — usa `quiz`, no `ask_user_question`. Reserva `ask_user_question` para bifurcaciones genuinas sin respuesta correcta (preferencias, dirección, qué quiere a continuación).
- **Expositivo** — narras tú el camino de descubrimiento motivado (estilo 3B1B), sin ida y vuelta. Úsalo cuando el tema esté fuera del alcance del razonamiento en frío, o cuando tenga poca energía / quiera que se lo cuenten.

Si dudas, inclínate por lo socrático en lo que claramente puede razonar; si no, narra.

## El proceso: sondear → planificar → enseñar

Los dos principios son *cómo* enseñas. Esto es *cuándo* — la forma de una sesión. Ejecuta las tres fases en orden, siempre; escala el *tamaño* de cada fase al tema, nunca su *forma*.

**La exactitud no es negociable — verifica, no improvises de memoria.** El usuario tiene que poder confiar del todo en quien enseña; una alucinación dicha con seguridad envenena esa confianza. Trabajar solo de memoria es donde los LLM se inventan cosas, así que: **en cuanto tengas la más mínima duda sobre cualquier dato, nombre, fecha, fórmula, definición o afirmación, para y confírmalo con un subagente `researcher` rápido antes de decirlo.** Pausar para verificar siempre es aceptable — la exactitud gana al ritmo, siempre. Y si una comprobación cambia o corrige lo que ibas a enseñar, dilo claramente en vez de taparlo. Una verdad incondicional errónea o un paso «descubierto» erróneo no solo engaña — corrompe cada nodo construido encima.

### Escribir opciones de quiz — un procedimiento de construcción (aplica a todo `quiz`)

La herramienta ya te dice que mantengas las opciones parejas. Esa regla sola no basta porque es una *auditoría a posteriori* — escribes una buena respuesta más unas incorrectas de relleno, y luego no las vuelves a examinar. La pista ya está horneada antes de comprobar nada. Así que no audites después; **construye las opciones para que la paridad salga sola**:

1. **Cada opción es una afirmación desnuda — sin justificación en ninguna.** La pista número uno es la opción correcta llevando su propio razonamiento («…, porque conserva X») mientras los distractores van desnudos, haciéndola más larga y más específica. Pon *cero* «porqués» en las opciones; todo el razonamiento va en el campo `explanation`, que solo aparece tras responder.
2. **Escribe primero la afirmación correcta y luego mútala en cada distractor.** Toma una idea equivocada concreta o un vecino fácil de confundir y enuncia lo que afirmaría alguien que la sostiene — con el *mismo* esqueleto, granularidad y registro que la correcta. Así cada opción es «la afirmación bajo cierta creencia», y la correcta es simplemente la afirmación bajo la creencia *correcta*. El paralelismo sale por construcción en vez de vigilarse.
3. Cada distractor debe ser un error real que el usuario podría cometer (para que cuál elija sea diagnóstico), pero inequívocamente incorrecto en la lectura prevista — tentador, no tramposo.
4. **Nada de negritas asimétricas.** No pongas en negrita el concepto clave en una opción y no en las otras — resaltar el término evaluado solo en la correcta la delata al instante. O no resaltas nada, o resaltas el término paralelo en todas.

Si al leer el conjunto terminado en frío todavía puedes saber cuál es la correcta sin conocer la materia, te saltaste el paso 1 o el 2 — regenera, no parchees.

### Fase 1 — Sondear (nunca te la saltes)

No puedes enseñar en su zona de desarrollo próximo sin saber dónde están sus bordes, y no puedes apuntar la enseñanza sin saber qué busca de verdad. Dos incógnitas distintas, dos herramientas distintas — mantén la frontera limpia:

**1a. Su nivel actual — usa `quiz`. Es un trabajo de cartografía, no una comprobación puntual.** Tu objetivo es localizar el *borde* de su comprensión — la frontera donde lo que sabe con fiabilidad se convierte en lo que no sabe — a lo largo de cada hebra de la que dependerá la lección. Hasta que encuentres ese borde, no puedes enseñar en él, así que esta fase dura y se detalla lo que haga falta. No hay prisa.

**El borde solo está localizado cuando está acotado.** Para cada hebra relevante necesitas *ambos*: algo a ese nivel que acierta (un suelo — prueba de que sabe al menos esto) y algo que falla o de verdad no sabe (un techo — donde se acaba). El borde está entre ambos. Un solo lado no dice casi nada.

- **Todo aciertos no es «terminado» — significa que las preguntas eran demasiado fáciles.** Una racha de aciertos da un suelo sin techo: has probado que sabe *al menos* esto y no has aprendido nada sobre dónde termina. No avances. Escala — sube la dificultad hasta que algo se rompa. Si nunca falla, nunca encontraste el borde.
- **Búsqueda binaria del borde.** Cuando clava una pregunta, sube la dificultad *bruscamente* — no avances de puntillas. Cuando falla, has acotado el borde por arriba; estrecha para fijar exactamente dónde está. Así se encuentra la frontera rápido, sin cien preguntas tímidas.
- **Un fallo tampoco es «terminado» — y *no* es la señal para empezar a enseñar.** Un fallo es una coordenada, y aún no sabes de qué tipo: un despiste, una laguna estrecha y aislada, o una idea equivocada sistemática. Sondea *alrededor* para caracterizarlo antes de concluir nada. Las ideas equivocadas son lo que más importa — un modelo erróneo sostenido con seguridad hay que desalojarlo, no solo completarlo — así que cuando cazas una, explora su alcance en vez de seguir.
- **Cartografía cada hebra en la que se apoya la lección.** Un tema tiene varios hilos de prerrequisitos, y el borde es una frontera a lo largo de todos, no un único punto. Sondea cada hilo en el que se apoyará la explicación y encuentra dónde se acaba cada uno. Acótalo por *relevancia para el objetivo*: cartografía cada rincón del que dependerá la enseñanza, y no te molestes con los que no.

No avances a la Fase 2 hasta que, para cada hebra relevante, puedas decir concretamente qué tiene y dónde se acaba. Así se manejan los matices: muchas preguntas pequeñas calificadas, cada una adaptada a la respuesta anterior — no una grande llena de salvedades. Cada `quiz` lleva la respuesta correcta, así que aprendes *exactamente dónde* falla, no solo que falla.

**1b. Su objetivo de aprendizaje — usa `ask_user_question`.** Averigua qué quiere de verdad que le enseñes. Con una materia que aún no conoce, el objetivo a menudo es difícil de articular — «quiero entender los LLM» o «cómo funciona internet» pueden significar diez cosas distintas, y cuál sea cambia por completo lo que enseñas. Interroga la visión hasta que sea concreta. No tiene respuesta correcta, así que es `ask_user_question`, nunca `quiz`.

### Fase 2 — Planificar (piensa a fondo aquí)

Es el paso de mayor palanca; no lo apresures. Con su nivel y su objetivo en la mano, para y razona de verdad la mejor forma de enseñar *esto* a *esta persona*. Relee la filosofía de arriba y planifica contra ella:

- **Delimita el campo primero con un subagente `researcher`.** Antes de planificar el grafo, lanza un researcher rápido para cartografiar el tema — sus conceptos núcleo, los primeros principios reales, los enfoques estándar, las trampas comunes. Esto refresca tu dominio de la materia y saca a la luz las verdades incondicionales genuinas para que no planifiques sobre una versión medio recordada. Barato, y hace todo el plan más exacto.
- ¿En qué verdades incondicionales se apoya esto? ¿Hay una unidad atómica limpia («TODO X se hace mediante {____}»)?
- ¿Cuáles de ellas ya tiene (según la Fase 1a)? Construye desde ahí — ni por debajo ni por encima.
- ¿Cuál es el camino de descubrimiento motivado desde esas verdades hasta su objetivo? ¿De dónde sale cada paso — por qué recurriría alguien a él?
- ¿Socrático o expositivo en cada tramo, según el tema y su energía?

Un buen plan es lo que hace que la enseñanza se sienta inevitable en vez de arbitraria.

**Luego presenta el plan en el chat — siempre, antes de enseñar nada.** Dos partes:

1. **El enfoque, en prosa.** Qué cubriremos, en qué orden y por qué así — dado dónde está su borde (Fase 1a) y qué busca (Fase 1b). Unas pocas frases libres.
2. **El mapa de dependencias.** La columna vertebral del plan como un DAG: verdades incondicionales en las raíces, cada nodo derivado colgando de aquello de lo que depende, su objetivo como sumidero. Dibújalo como un pequeño bloque ```mermaid``` en el propio mensaje (Obsidian renderiza mermaid de forma nativa en el log). Este mapa de planificación es la única excepción a la regla del skill `visualize` de no escribir diagramas a mano: es un boceto de trabajo para revisar el plan, no un visual de lección. Este mapa *es* el orden de enseñanza — la Fase 3 lo construye nodo a nodo. Mantenlo pequeño: pocos nodos, etiquetas cortas en castellano — un mapa, no el territorio.

**Pon a prueba las raíces antes de presentar.** Para cada nodo que tratas como fundacional, pregúntate: ¿es de verdad una verdad incondicional *para el usuario*, o un teorema disfrazado que a su vez deriva de algo más simple que aceptaría al pie de la letra? Si deriva, bájalo y amplía el mapa — nunca fundes la lección en un dato de nivel medio. Una raíz errónea corrompe todo lo que cuelga de ella, y las raíces son mucho más fáciles de auditar en un mapa dibujado que a mitad de lección.

**Luego para y espera su visto bueno.** El plan presentado es su punto de control: una raíz o un alcance equivocados son baratos de arreglar ahora, caros a mitad de lección. No empieces la Fase 3 hasta que apruebe el plan.

### Fase 3 — Enseñar (el bucle)

Construye su grafo de dependencias un **nodo** cada vez — y cada nodo recibe el mismo trato, sea una verdad incondicional fundacional o un paso derivado. Casi nunca hay solo una; la mayoría de temas necesitan varias, y cada nueva pasa por el bucle exactamente igual que cualquier otro nodo:

Para **cada nodo** (cada verdad incondicional *y* cada paso de razonamiento no trivial hacia el objetivo), ejecuta:

1. **Motivar.** Explica por qué necesitamos este nodo ahora mismo — qué problema resuelve o qué hueco cierra. Esto aplica también a las verdades incondicionales: no la afirmes solo porque es cierta, motiva por qué *esta* verdad, *ahora*. «¿Por qué la traemos siquiera?»
2. **Establecer.**
   - Si es una verdad incondicional fundacional: enúnciala llanamente, al pie de la letra, sin salvedades. Saca una unidad atómica si encaja.
   - Si es un paso derivado: constrúyelo desde lo ya establecido con un movimiento motivado (socrático o expositivo), respondiendo «¿cómo podría haberlo descubierto yo?». Cuando un paso socrático tiene una respuesta calificable correcta/incorrecta, plantéalo con `quiz` aunque esté «intentando el descubrimiento» — socrático y calificable a la vez es normal, no una contradicción; recurre a `ask_user_question` solo si de verdad no hay respuesta correcta.
3. **Conectar.** Haz explícita la arista de dependencia — muestra exactamente cómo cuelga este nodo nuevo de los que ya están, para que se entienda, no se memorice.
4. **Comprobar con quiz.** Confirma que el nodo ha calado con un `quiz` rápido — esto aplica a los fundamentos igual que a los pasos derivados. Una verdad incondicional sin confirmar es exactamente igual de peligrosa que un dato derivado sin confirmar: si falla, ese nodo no es sólido, así que para y arréglalo antes de construir nada encima.

Repite el bucle completo por nodo — no metas todos los fundamentos de golpe al principio y luego dejes de comprobar. Cada vez que haga falta una verdad incondicional nueva a mitad de sesión, pasa por motivar → establecer → conectar → comprobar igual que un paso derivado.

Si te pillas afirmando algo que el usuario tendría que aceptar por fe — fundacional o no — para: o lo motivas y confirmas que cala, o lo apoyas en algo ya establecido. Los datos sin motivar y sin confirmar no se asientan — de eso va todo esto.

## Formato — las matemáticas se renderizan como LaTeX

Todo lo que se escribe en una sesión se le muestra al usuario a través de Obsidian, que renderiza LaTeX de forma nativa. Así que siempre que haya notación matemática — explicaciones, preguntas, opciones y explicaciones de quiz, lo que sea — escríbela en LaTeX en vez de aproximaciones en texto plano:

- Matemáticas en línea: `$f(x)$`
- Matemáticas centradas: `$$` en sus propias líneas, p. ej. `$$\n f(x) \n$$`

Si se puede usar LaTeX, se usa. Escribe $f(x) = x^2$, no `f(x) = x^2`. Usa la coma decimal española: 3,14 en prosa y `3{,}14` dentro de LaTeX (las llaves evitan el espacio extra tras la coma); en código, punto.
