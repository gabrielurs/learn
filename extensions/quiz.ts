import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Editor, Key, Text, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import { Type } from "@sinclair/typebox";
import { addWrapped, createEditorTheme, partialOptionLabels, withUILock } from "./_shared/ui.ts";

// ────────────────────────────────────────────────────────────────────────────
// quiz — a GRADED sibling of ask_user_question.
//
// Where ask_user_question collects a preference/decision with no notion of
// right or wrong, `quiz` poses a question that HAS a correct answer, grades the
// user's selection instantly, and shows tight feedback (✓/✗ + the correct
// answer + an optional explanation) to both the user and the agent.
//
// It is intentionally options-only: single-select or multi-select. There is no
// free-text mode and no "Other" option, because a free-text answer can't be
// graded against a correct index.
// ────────────────────────────────────────────────────────────────────────────

interface QuizOption {
	label: string;
	value: string;
	description?: string;
}

interface DisplayOption extends QuizOption {
	id: string;
	index: number;
	isSubmit?: boolean;
}

interface OptionAnswer {
	label: string;
	value: string;
	index: number; // 1-based, matches the number shown to the user
}

// The always-present "I don't know" choice. It is NOT a real option: it never
// participates in shuffling, has no correct-answer value, and produces a
// distinct signal (dontKnow) rather than a right/wrong grade — so an honest
// "I don't know" is never confused with a lucky or unlucky guess.
const DONT_KNOW_VALUE = "__dont_know__";
const DONT_KNOW_LABEL = "No lo sé";
const DONT_KNOW_INDEX = 0; // real options are 1-based; submit uses -1

// Unified response from either ask* component. answers holds the real
// selections (empty when dontKnow); note is the optional free-text the user
// typed in the always-present note field (kept only when non-empty).
interface QuizResponse {
	dontKnow: boolean;
	note?: string;
	answers: OptionAnswer[];
}

type QuizStatus = "answered" | "cancelled" | "unavailable";
type QuizMode = "single-select" | "multi-select";

interface DisplayedOption {
	index: number; // 1-based, in the final (possibly shuffled) display order
	label: string;
}

interface QuizResultDetails {
	status: QuizStatus;
	question: string;
	context?: string;
	mode: QuizMode;
	answers: OptionAnswer[];
	correctIndices: number[];
	options?: DisplayedOption[]; // full option list in display order, for the transcript
	correct?: boolean;
	dontKnow?: boolean; // user selected "I don't know" instead of guessing
	note?: string; // optional free-text from the always-present note field (any answer)
	explanation?: string;
	message?: string;
}

const OptionSchema = Type.Object({
	label: Type.String({ description: "Etiqueta visible de la opción de respuesta." }),
	value: Type.Optional(
		Type.String({ description: "Valor opcional legible por máquina devuelto para la opción. Por defecto, la etiqueta." }),
	),
	description: Type.Optional(Type.String({ description: "Detalle extra opcional mostrado bajo la opción." })),
});

const QuizParams = Type.Object({
	question: Type.String({
		description: "La única pregunta del quiz. Exactamente una pregunta por llamada.",
	}),
	details: Type.Optional(
		Type.String({ description: "Contexto o instrucciones extra opcionales mostrados bajo la pregunta." }),
	),
	options: Type.Array(OptionSchema, {
		description:
			"Las opciones de respuesta (2 o más). Solo opciones — no hay modo de texto libre. Da a cada opción un `value` estable; la correcta se referencia por ese value en correctAnswer.",
		minItems: 2,
	}),
	multiSelect: Type.Optional(
		Type.Boolean({ description: "true cuando hay más de una opción correcta y el usuario debe marcarlas todas." }),
	),
	correctAnswer: Type.Union([Type.String(), Type.Array(Type.String())], {
		description:
			'OBLIGATORIO. La respuesta correcta como value(s) de opción — el campo `value` de la opción que quieres. Selección única: un string (p. ej. "mercurio"). Selección múltiple: un array de strings (p. ej. ["belice", "niue"]); el usuario acierta solo si su selección coincide exactamente con ese conjunto. Pasa siempre el value, no un número de posición — se autoverifica y evita errores al contar.',
	}),
	explanation: Type.String({
		description:
			"OBLIGATORIO. Explicación que se revela DESPUÉS de responder (se muestra acierte o falle). Úsala para reforzar por qué la respuesta correcta es correcta.",
	}),
	shuffle: Type.Optional(
		Type.Boolean({
			description:
				"Por defecto true: las opciones se reordenan al azar antes de mostrarse para que la correcta no esté siempre en la misma posición. Ponlo a false solo si el orden importa (p. ej. valores numéricos ordenados, o una opción 'Todas/Ninguna de las anteriores' que debe ir al final).",
		}),
	),
});

function normalizeOptions(
	options: Array<{ label: string; value?: string; description?: string }> | undefined,
): QuizOption[] {
	const seen = new Set<string>();
	return (options || [])
		.map((option) => ({
			label: option.label.trim(),
			value: option.value?.trim() || option.label.trim(),
			description: option.description?.trim() || undefined,
		}))
		.filter((option) => {
			if (option.label.length === 0) return false;
			if (seen.has(option.value)) throw new Error(`value de opción duplicado "${option.value}"`);
			seen.add(option.value);
			return true;
		});
}

// Fisher-Yates shuffle over a copy. Safe to reorder for display because
// correctAnswer is keyed by value, not position — indices are resolved AFTER
// shuffling, so grading always matches what the user actually sees.
function shuffleOptions(options: QuizOption[]): QuizOption[] {
	const out = [...options];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

// Resolve author-supplied option value(s) to 1-based indices. Keying by value
// (not position) makes the correct answer self-documenting: the author writes
// `correctAnswer: "mercury"` and a typo becomes a hard error instead of a
// silent wrong grade.
// The harness sometimes delivers a multi-select `correctAnswer` array as a
// JSON-stringified string (e.g. '["a", "b"]') instead of a real array, because
// the schema union lists String first. Detect that case and parse it back into
// an array so grading resolves against real option values. A plain single value
// is wrapped as-is.
function coerceCorrectAnswer(correctAnswer: string | string[]): string[] {
	if (Array.isArray(correctAnswer)) return correctAnswer;
	const trimmed = correctAnswer.trim();
	if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
		try {
			const parsed = JSON.parse(trimmed);
			if (Array.isArray(parsed)) return parsed.map((v) => String(v));
		} catch {
			// Not valid JSON — fall through and treat as a single literal value.
		}
	}
	return [correctAnswer];
}

function resolveCorrect(
	correctAnswer: string | string[] | undefined,
	options: QuizOption[],
): { indices: number[]; error?: string } {
	if (correctAnswer === undefined) return { indices: [], error: "correctAnswer es obligatorio" };
	const arr = coerceCorrectAnswer(correctAnswer);
	if (arr.length === 0) return { indices: [], error: "correctAnswer es obligatorio" };
	const byValue = new Map(options.map((o, i) => [o.value, i + 1]));
	const indices: number[] = [];
	for (const raw of arr) {
		const v = typeof raw === "string" ? raw.trim() : raw;
		const idx = byValue.get(v);
		if (idx === undefined) {
			const known = options.map((o) => `"${o.value}"`).join(", ");
			return { indices: [], error: `correctAnswer "${v}" no coincide con ningún value de opción (${known})` };
		}
		indices.push(idx);
	}
	return { indices: Array.from(new Set(indices)).sort((a, b) => a - b) };
}

function isCorrect(selectedIndices: number[], correctIndices: number[]): boolean {
	if (selectedIndices.length !== correctIndices.length) return false;
	const a = [...selectedIndices].sort((x, y) => x - y);
	const b = [...correctIndices].sort((x, y) => x - y);
	return a.every((v, i) => v === b[i]);
}

function buildStructuredResult(
	status: QuizStatus,
	question: string,
	mode: QuizMode,
	answers: OptionAnswer[],
	correctIndices: number[],
	correct: boolean | undefined,
	explanation: string | undefined,
	context?: string,
	message?: string,
	options?: DisplayedOption[],
	dontKnow?: boolean,
	note?: string,
): QuizResultDetails {
	return { status, question, context, mode, answers, correctIndices, options, correct, dontKnow, note, explanation, message };
}

function cancelledResult(question: string, mode: QuizMode, correctIndices: number[], context?: string) {
	const message = "El usuario canceló el quiz";
	return {
		content: [{ type: "text" as const, text: message }],
		details: buildStructuredResult("cancelled", question, mode, [], correctIndices, undefined, undefined, context, message),
	};
}

function unavailableResult(question: string, mode: QuizMode, message: string, correctIndices: number[], context?: string) {
	return {
		content: [{ type: "text" as const, text: message }],
		details: buildStructuredResult("unavailable", question, mode, [], correctIndices, undefined, undefined, context, message),
	};
}

function formatOptionRef(options: QuizOption[], index: number): string {
	const opt = options.find((o, i) => i + 1 === index);
	return `${index}. ${opt ? opt.label : "(desconocida)"}`;
}

function buildResult(
	question: string,
	context: string | undefined,
	mode: QuizMode,
	options: QuizOption[],
	response: QuizResponse,
	correctIndices: number[],
	explanation: string | undefined,
) {
	const { dontKnow, note, answers } = response;
	const selectedIndices = answers.map((a) => a.index);
	// "I don't know" is never counted as correct — it's a distinct outcome.
	const correct = dontKnow ? false : isCorrect(selectedIndices, correctIndices);
	const correctStr = correctIndices.map((i) => formatOptionRef(options, i)).join(", ");
	const displayedOptions: DisplayedOption[] = options.map((o, i) => ({ index: i + 1, label: o.label }));

	let text: string;
	if (dontKnow) {
		// Make the signal explicit for the agent: the user did NOT guess, so this
		// is a genuine knowledge gap, not a wrong answer to correct against.
		text = `El usuario eligió "No lo sé" — no intentó responder (una laguna real de conocimiento, no un fallo al adivinar).`;
		text += `\nCorrecta: ${correctStr}`;
		if (note) text += `\nNota del usuario: ${note}`;
	} else {
		const verdict = correct ? "correctamente" : "incorrectamente";
		const selectedStr = answers.map((a) => `${a.index}. ${a.label}`).join(", ");
		text = `El usuario respondió ${verdict}.\nSeleccionada: ${selectedStr}\nCorrecta: ${correctStr}`;
		if (note) text += `\nNota del usuario: ${note}`;
	}
	if (explanation) text += `\nExplicación: ${explanation}`;

	return {
		content: [{ type: "text" as const, text }],
		details: buildStructuredResult(
			"answered",
			question,
			mode,
			answers,
			correctIndices,
			correct,
			explanation,
			context,
			undefined,
			displayedOptions,
			dontKnow,
			note,
		),
	};
}

// Shared feedback block, rendered after the user submits.
function renderFeedback(
	lines: string[],
	theme: any,
	width: number,
	options: QuizOption[],
	selectedIndices: number[],
	correctIndices: number[],
	explanation: string | undefined,
	dontKnow = false,
	note?: string,
): void {
	const add = (text: string) => lines.push(truncateToWidth(text, width));
	const correct = !dontKnow && isCorrect(selectedIndices, correctIndices);
	const selectedSet = new Set(selectedIndices);
	const correctSet = new Set(correctIndices);

	lines.push("");
	for (let i = 0; i < options.length; i++) {
		const index = i + 1;
		const opt = options[i];
		const isSelected = selectedSet.has(index);
		const isKey = correctSet.has(index);
		let marker: string;
		let color: string;
		if (dontKnow) {
			// No guess was made — only reveal the correct answer(s); never show ✗.
			marker = isKey ? "✓" : " ";
			color = isKey ? "success" : "dim";
		} else if (isSelected && isKey) {
			marker = "✓";
			color = "success";
		} else if (isSelected && !isKey) {
			marker = "✗";
			color = "error";
		} else if (!isSelected && isKey) {
			// correct answer the user missed
			marker = "✓";
			color = "success";
		} else {
			marker = " ";
			color = "dim";
		}
		add(theme.fg(color, ` ${marker} ${index}. ${opt.label}`));
	}

	lines.push("");
	if (dontKnow) {
		add(theme.fg("warning", " · Dijiste: No lo sé"));
		const correctStr = correctIndices.map((i) => formatOptionRef(options, i)).join(", ");
		addWrapped(lines, theme.fg("muted", `Respuesta correcta: ${correctStr}`), width, " ");
	} else if (correct) {
		add(theme.fg("success", " ✓ ¡Correcto!"));
	} else {
		add(theme.fg("error", " ✗ Incorrecto."));
		const correctStr = correctIndices.map((i) => formatOptionRef(options, i)).join(", ");
		addWrapped(lines, theme.fg("muted", `Respuesta correcta: ${correctStr}`), width, " ");
	}
	if (note) {
		addWrapped(lines, theme.fg("muted", `Tu nota: ${note}`), width, " ");
	}
	if (explanation) {
		lines.push("");
		addWrapped(lines, theme.fg("text", explanation), width, " ");
	}
	lines.push("");
	add(theme.fg("dim", " Enter/Esc para continuar"));
}

// Top border + question + optional context. Shared by both components.
function pushHeader(lines: string[], theme: any, width: number, question: string, context: string | undefined): void {
	lines.push(truncateToWidth(theme.fg("accent", "─".repeat(width)), width));
	addWrapped(lines, theme.fg("text", question), width, " ");
	if (context) {
		lines.push("");
		addWrapped(lines, theme.fg("muted", context), width, " ");
	}
}

// The "I don't know" row in the selection list — visually separated and dimmed
// so it reads as distinct from the real, gradable options.
function pushDontKnowRow(lines: string[], theme: any, width: number, focused: boolean): void {
	lines.push("");
	const prefix = focused ? theme.fg("accent", "> ") : "  ";
	const styled = focused ? theme.fg("accent", DONT_KNOW_LABEL) : theme.fg("dim", DONT_KNOW_LABEL);
	lines.push(truncateToWidth(`${prefix}${styled}`, width));
}

// Persistent, always-present note field rendered under the options during the
// select phase. Applies to ANY answer (including "I don't know") and is only
// surfaced to the agent when non-empty.
function pushNoteField(lines: string[], theme: any, width: number, editor: Editor, focused: boolean): void {
	lines.push("");
	const label = focused ? theme.fg("accent", "Nota (opcional):") : theme.fg("muted", "Nota (opcional):");
	addWrapped(lines, label, width, " ");
	for (const line of editor.render(width)) lines.push(line);
}

// Build the note Editor. `disableSubmit` is set because Enter must NOT submit
// here: the editor's submit path clears the buffer, which would wipe the note.
// Instead the host intercepts Enter to return focus to the options while
// keeping the text. Ctrl+J still inserts a newline (pi convention), so
// multi-line notes work.
function makeNoteEditor(tui: any, theme: any): Editor {
	const editor = new Editor(tui, createEditorTheme(theme));
	editor.focused = false;
	editor.disableSubmit = true;
	return editor;
}

async function askSingleChoice(
	ctx: any,
	question: string,
	context: string | undefined,
	options: QuizOption[],
	correctIndices: number[],
	explanation: string | undefined,
): Promise<QuizResponse | null> {
	const allOptions: DisplayOption[] = options.map((option, index) => ({
		...option,
		id: `option:${index}`,
		index: index + 1,
	}));
	const dontKnowNav = allOptions.length; // nav index of the "I don't know" row

	return ctx.ui.custom<QuizResponse | null>(
		(tui: any, theme: any, _kb: any, done: (result: QuizResponse | null) => void) => {
			let optionIndex = 0;
			let phase: "select" | "feedback" = "select";
			let focus: "options" | "note" = "options";
			let chosen: OptionAnswer | null = null;
			let dontKnow = false;
			const editor = makeNoteEditor(tui, theme);
			let cachedLines: string[] | undefined;
			let cachedWidth = -1;

			function refresh() {
				cachedLines = undefined;
				tui.requestRender();
			}

			function noteText(): string | undefined {
				const t = editor.getText().trim();
				return t.length ? t : undefined;
			}

			function toOptions() {
				focus = "options";
				editor.focused = false;
				refresh();
			}

			function response(): QuizResponse {
				const note = noteText();
				return dontKnow
					? { dontKnow: true, note, answers: [] }
					: { dontKnow: false, note, answers: chosen ? [chosen] : [] };
			}

			function handleInput(data: string) {
				if (phase === "feedback") {
					if (matchesKey(data, Key.enter) || matchesKey(data, Key.escape)) {
						done(response());
					}
					return;
				}

				// Tab toggles focus between the options list and the note field.
				if (matchesKey(data, Key.tab)) {
					focus = focus === "options" ? "note" : "options";
					editor.focused = focus === "note";
					refresh();
					return;
				}

				if (focus === "note") {
					// Enter and Esc both return to the options and keep the note text.
					// (Enter must be intercepted here: the editor's own submit clears
					// the buffer. Ctrl+J still reaches the editor as a newline.)
					if (matchesKey(data, Key.enter) || matchesKey(data, Key.escape)) {
						toOptions();
						return;
					}
					editor.handleInput(data);
					tui.requestRender();
					return;
				}

				// focus === "options"
				if (matchesKey(data, Key.up)) {
					optionIndex = Math.max(0, optionIndex - 1);
					refresh();
					return;
				}
				if (matchesKey(data, Key.down)) {
					optionIndex = Math.min(dontKnowNav, optionIndex + 1);
					refresh();
					return;
				}
				if (matchesKey(data, Key.enter)) {
					if (optionIndex === dontKnowNav) {
						dontKnow = true;
						chosen = null;
					} else {
						const selected = allOptions[optionIndex];
						chosen = { label: selected.label, value: selected.value, index: selected.index };
						dontKnow = false;
					}
					phase = "feedback";
					refresh();
					return;
				}
				if (matchesKey(data, Key.escape)) {
					done(null);
				}
			}

			function render(width: number): string[] {
				// The cache MUST be keyed on width: pi-tui calls requestRender() but NOT
				// invalidate() on terminal resize, so render() can be re-entered with a
				// new width. Returning stale wider lines trips the TUI width guard and
				// crashes the process.
				if (cachedLines && cachedWidth === width) return cachedLines;

				const lines: string[] = [];
				const add = (text: string) => lines.push(truncateToWidth(text, width));
				pushHeader(lines, theme, width, question, context);

				if (phase === "feedback") {
					renderFeedback(
						lines,
						theme,
						width,
						options,
						chosen ? [chosen.index] : [],
						correctIndices,
						explanation,
						dontKnow,
						noteText(),
					);
					add(theme.fg("accent", "─".repeat(width)));
					cachedLines = lines;
					cachedWidth = width;
					return lines;
				}

				lines.push("");
				for (let i = 0; i < allOptions.length; i++) {
					const option = allOptions[i];
					const selected = focus === "options" && i === optionIndex;
					const prefix = selected ? theme.fg("accent", "> ") : "  ";
					const label = `${option.index}. ${option.label}`;
					const styled = selected ? theme.fg("accent", label) : theme.fg("text", label);
					add(`${prefix}${styled}`);
					if (option.description) {
						addWrapped(lines, theme.fg("muted", option.description), width, "     ");
					}
				}

				pushDontKnowRow(lines, theme, width, focus === "options" && optionIndex === dontKnowNav);

				pushNoteField(lines, theme, width, editor, focus === "note");

				lines.push("");
				if (focus === "note") {
					add(theme.fg("dim", " Escribe la nota • Ctrl+J nueva línea • Enter/Tab/Esc volver a las opciones"));
				} else {
					add(theme.fg("dim", " ↑↓ navegar • Enter responder • Tab nota • Esc cancelar"));
				}
				add(theme.fg("accent", "─".repeat(width)));
				// Not cached when the note is focused: the editor renders a live cursor.
				if (focus !== "note") {
					cachedLines = lines;
					cachedWidth = width;
				}
				return lines;
			}

			return {
				render,
				invalidate: () => {
					cachedLines = undefined;
					editor.invalidate();
				},
				handleInput,
			};
		},
	);
}

async function askMultiChoice(
	ctx: any,
	question: string,
	context: string | undefined,
	options: QuizOption[],
	correctIndices: number[],
	explanation: string | undefined,
): Promise<QuizResponse | null> {
	const DONT_KNOW_ID = "dont-know";
	const choiceItems: DisplayOption[] = options.map((option, index) => ({
		...option,
		id: `option:${index}`,
		index: index + 1,
	}));
	const dontKnowItem: DisplayOption = {
		id: DONT_KNOW_ID,
		label: DONT_KNOW_LABEL,
		value: DONT_KNOW_VALUE,
		index: DONT_KNOW_INDEX,
	};
	const submitItem: DisplayOption = { id: "submit", label: "Enviar", value: "__submit__", index: -1, isSubmit: true };
	const allItems: DisplayOption[] = [...choiceItems, dontKnowItem, submitItem];

	return ctx.ui.custom<QuizResponse | null>(
		(tui: any, theme: any, _kb: any, done: (result: QuizResponse | null) => void) => {
			let optionIndex = 0;
			let phase: "select" | "feedback" = "select";
			let focus: "options" | "note" = "options";
			const editor = makeNoteEditor(tui, theme);
			let cachedLines: string[] | undefined;
			let cachedWidth = -1;
			const selected = new Map<string, OptionAnswer>();

			function refresh() {
				cachedLines = undefined;
				tui.requestRender();
			}

			function noteText(): string | undefined {
				const t = editor.getText().trim();
				return t.length ? t : undefined;
			}

			function toOptions() {
				focus = "options";
				editor.focused = false;
				refresh();
			}

			const choseDontKnow = () => selected.has(DONT_KNOW_ID);
			const realAnswers = () =>
				sortAnswers(Array.from(selected.values()).filter((a) => a.index !== DONT_KNOW_INDEX));

			function response(): QuizResponse {
				const note = noteText();
				return choseDontKnow()
					? { dontKnow: true, note, answers: [] }
					: { dontKnow: false, note, answers: realAnswers() };
			}

			// "I don't know" is exclusive: choosing it clears real selections, and
			// choosing any real option clears "I don't know".
			function toggleOption(item: DisplayOption) {
				if (item.id === DONT_KNOW_ID) {
					if (selected.has(DONT_KNOW_ID)) {
						selected.delete(DONT_KNOW_ID);
					} else {
						selected.clear();
						selected.set(DONT_KNOW_ID, { label: item.label, value: item.value, index: item.index });
					}
				} else {
					selected.delete(DONT_KNOW_ID);
					if (selected.has(item.id)) {
						selected.delete(item.id);
					} else {
						selected.set(item.id, { label: item.label, value: item.value, index: item.index });
					}
				}
				refresh();
			}

			function submit() {
				if (selected.size === 0) return;
				phase = "feedback";
				refresh();
			}

			function handleInput(data: string) {
				if (phase === "feedback") {
					if (matchesKey(data, Key.enter) || matchesKey(data, Key.escape)) {
						done(response());
					}
					return;
				}

				// Tab toggles focus between the options list and the note field.
				if (matchesKey(data, Key.tab)) {
					focus = focus === "options" ? "note" : "options";
					editor.focused = focus === "note";
					refresh();
					return;
				}

				if (focus === "note") {
					// Enter and Esc both return to the options and keep the note text.
					// (Enter must be intercepted here: the editor's own submit clears
					// the buffer. Ctrl+J still reaches the editor as a newline.)
					if (matchesKey(data, Key.enter) || matchesKey(data, Key.escape)) {
						toOptions();
						return;
					}
					editor.handleInput(data);
					tui.requestRender();
					return;
				}

				// focus === "options"
				if (matchesKey(data, Key.up)) {
					optionIndex = Math.max(0, optionIndex - 1);
					refresh();
					return;
				}
				if (matchesKey(data, Key.down)) {
					optionIndex = Math.min(allItems.length - 1, optionIndex + 1);
					refresh();
					return;
				}

				const current = allItems[optionIndex];
				if (matchesKey(data, Key.space)) {
					if (current.isSubmit) return;
					toggleOption(current);
					return;
				}

				if (matchesKey(data, Key.enter)) {
					if (current.isSubmit) {
						submit();
						return;
					}
					toggleOption(current);
					return;
				}

				if (matchesKey(data, Key.escape)) {
					done(null);
				}
			}

			function render(width: number): string[] {
				// The cache MUST be keyed on width: pi-tui calls requestRender() but NOT
				// invalidate() on terminal resize, so render() can be re-entered with a
				// new width. Returning stale wider lines trips the TUI width guard and
				// crashes the process.
				if (cachedLines && cachedWidth === width) return cachedLines;

				const lines: string[] = [];
				const add = (text: string) => lines.push(truncateToWidth(text, width));
				pushHeader(lines, theme, width, question, context);

				if (phase === "feedback") {
					renderFeedback(
						lines,
						theme,
						width,
						options,
						realAnswers().map((a) => a.index),
						correctIndices,
						explanation,
						choseDontKnow(),
						noteText(),
					);
					add(theme.fg("accent", "─".repeat(width)));
					cachedLines = lines;
					cachedWidth = width;
					return lines;
				}

				lines.push("");
				for (let i = 0; i < allItems.length; i++) {
					const item = allItems[i];
					const isFocused = focus === "options" && i === optionIndex;
					const prefix = isFocused ? theme.fg("accent", "> ") : "  ";

					if (item.isSubmit) {
						const label = selected.size > 0 ? `✓ ${item.label} (${selected.size} marcadas)` : `○ ${item.label}`;
						const styled = isFocused
							? theme.fg("accent", label)
							: theme.fg(selected.size > 0 ? "success" : "dim", label);
						add(`${prefix}${styled}`);
						continue;
					}

					if (item.id === DONT_KNOW_ID) {
						lines.push(""); // visual separation from the real options
						const checked = selected.has(item.id);
						const label = `${checked ? "[x]" : "[ ]"} ${item.label}`;
						const styled = isFocused ? theme.fg("accent", label) : theme.fg(checked ? "warning" : "dim", label);
						add(`${prefix}${styled}`);
						continue;
					}

					const checked = selected.has(item.id);
					const marker = checked ? "[x]" : "[ ]";
					const label = `${marker} ${item.index}. ${item.label}`;
					const styled = isFocused ? theme.fg("accent", label) : theme.fg(checked ? "success" : "text", label);
					add(`${prefix}${styled}`);
					if (item.description) {
						addWrapped(lines, theme.fg("muted", item.description), width, "     ");
					}
				}

				pushNoteField(lines, theme, width, editor, focus === "note");

				lines.push("");
				if (selected.size === 0) {
					add(theme.fg("warning", " Marca al menos una respuesta antes de enviar."));
				}
				if (focus === "note") {
					add(theme.fg("dim", " Escribe la nota • Ctrl+J nueva línea • Enter/Tab/Esc volver a las opciones"));
				} else {
					add(theme.fg("dim", " ↑↓ navegar • Espacio/Enter marcar • Enter en Enviar para enviar • Tab nota • Esc cancelar"));
				}
				add(theme.fg("accent", "─".repeat(width)));
				// Not cached when the note is focused: the editor renders a live cursor.
				if (focus !== "note") {
					cachedLines = lines;
					cachedWidth = width;
				}
				return lines;
			}

			return {
				render,
				invalidate: () => {
					cachedLines = undefined;
					editor.invalidate();
				},
				handleInput,
			};
		},
	);
}

function sortAnswers(answers: OptionAnswer[]): OptionAnswer[] {
	return [...answers].sort((a, b) => a.index - b.index);
}

export default function quiz(pi: ExtensionAPI) {
	pi.registerTool({
		name: "quiz",
		label: "quiz",
		description:
			"Hace al usuario una pregunta CALIFICADA con respuesta correcta conocida, la corrige al instante y da feedback. A diferencia de ask_user_question (que recoge preferencias/decisiones sin respuesta correcta), quiz siempre lleva una respuesta correcta que das tú, marca la selección del usuario como acierto/fallo (✓/✗), revela la respuesta correcta y puede mostrar una explicación. Úsalo para (1) evaluar qué entiende ya el aprendiz antes de enseñar, y (2) hacer bucles cortos de práctica/recuperación tras explicar, o comprobar la comprensión cuando no estés seguro de que lo ha captado. Solo opciones: selección única o múltiple, más una opción automática 'No lo sé' para que el usuario señale una laguna real en vez de adivinar. Un campo de nota opcional siempre presente (Tab para enfocarlo) permite adjuntar texto libre a CUALQUIER respuesta; solo te llega si no está vacío. Sin respuestas de texto libre — para preguntas no calificadas usa ask_user_question.",
		promptSnippet:
			"Usa la herramienta quiz para evaluar al usuario con una pregunta calificada de opción única o múltiple (respuesta correcta y explicación obligatorias). Para preguntas no calificadas, usa ask_user_question.",
		promptGuidelines: [
			"Escribe la pregunta, las opciones y la explicación SIEMPRE en castellano.",
			"quiz es CALIFICADO; ask_user_question no. Si la pregunta tiene respuesta correcta, usa quiz. Si solo necesitas una preferencia, decisión o respuesta abierta, usa ask_user_question.",
			'correctAnswer es OBLIGATORIO y es el value de la opción, no un número de posición. Selección única: un string (p. ej. "mercurio"). Selección múltiple: un array de strings (p. ej. ["belice", "niue"]).',
			"Pasa siempre el string `value` de la opción como correctAnswer — se autoverifica y evita errores al contar posiciones. Un value que no coincide con ninguna opción es un error.",
			"explanation es OBLIGATORIA — di siempre por qué la respuesta correcta es correcta.",
			"La selección múltiple se califica como coincidencia exacta de conjunto: el usuario acierta solo si marca todas las correctas y ninguna incorrecta.",
			"No hay modo de texto libre. La opción 'No lo sé' se añade SIEMPRE automáticamente — da SOLO las opciones reales y calificables (al menos dos). Nunca añadas tu propia opción de duda como 'No lo sé', 'No estoy seguro' o 'Ni idea'; ya está cubierta y una manual sería redundante o se calificaría como fallo.",
			"Si el resultado vuelve como dontKnow, el usuario honestamente no lo sabía y NO adivinó — trátalo como una laguna real en la que enseñar, no como una respuesta incorrecta.",
			"Cualquier respuesta (acierto, fallo o 'No lo sé') puede llevar una `note` de texto libre que el usuario escribió en el campo de nota. Si aparece, refleja lo que pensaba o dudaba — léela y deja que guíe tu siguiente paso. Se omite si está vacía.",
			"Trata cada respuesta incorrecta (distractor) como una sonda diagnóstica, no como relleno: que sea un error concreto y creíble que el usuario podría tener — una idea equivocada común, o un concepto vecino fácil de confundir — para que CUÁL elija revele QUÉ matiz de su comprensión falla. Aprendes mucho más de un distractor dirigido que de un acierto/fallo binario, y la elección te dice exactamente qué laguna enseñar después (y qué debe tratar la explicación).",
			"Límite: cada distractor debe ser inequívocamente incorrecto en la lectura prevista — tentador, pero un error real, no una alternativa defendible. No caigas en preguntas trampa.",
			"Higiene anti-adivinanza: que la respuesta correcta no destaque por su forma (la más larga, la más precisa, la más matizada o la única en el formato correcto). Mantén las opciones parecidas en longitud, especificidad y redacción para que no se pueda elegir solo por la forma.",
			"Pon multiSelect: true solo cuando haya más de una opción correcta.",
			"Las opciones se barajan antes de mostrarse por defecto, así que no importa en qué posición pongas la correcta. Pon shuffle: false solo si el orden importa (valores ordenados, o una opción 'Todas/Ninguna de las anteriores' que debe ir al final).",
			"Para sondear matices, haz varias preguntas cortas adaptando cada una a las respuestas anteriores, en vez de una pregunta gigante.",
			"No filtres la respuesta con el formato: redacción y longitud parejas, sin pistas de cuál es la correcta.",
		],
		parameters: QuizParams,

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const context = params.details?.trim() || undefined;
			const explanation = params.explanation.trim();
			const mode: QuizMode = params.multiSelect ? "multi-select" : "single-select";

			let options: QuizOption[];
			try {
				options = normalizeOptions(params.options);
			} catch (e) {
				return unavailableResult(params.question, mode, `quiz: ${(e as Error).message}`, [], context);
			}

			// Shuffle for display (default on) BEFORE resolving correct indices, so
			// grading matches the order the user sees.
			if (params.shuffle !== false) {
				options = shuffleOptions(options);
			}

			const { indices: correctIndices, error: correctError } = resolveCorrect(
				params.correctAnswer as string | string[],
				options,
			);

			if (signal?.aborted) {
				return cancelledResult(params.question, mode, correctIndices, context);
			}

			if (options.length < 2) {
				return unavailableResult(params.question, mode, "quiz necesita al menos dos opciones", correctIndices, context);
			}

			if (correctError) {
				return unavailableResult(params.question, mode, `quiz: ${correctError}`, correctIndices, context);
			}

			if (!ctx.hasUI) {
				return unavailableResult(params.question, mode, "quiz necesita la UI del modo interactivo", correctIndices, context);
			}

			// Emit the true (post-shuffle) display order before the UI blocks on the
			// user's answer. Listeners such as md-log rely on this to show the
			// question in the SAME order the user sees it, instead of the
			// pre-shuffle order of the tool call. Emitted only after validation, so
			// an invalid quiz never leaves an orphaned question in the log.
			// Deliberately omits correctIndices/explanation — the user hasn't
			// answered yet and the log is read live.
			onUpdate?.({
				content: [{ type: "text", text: "Esperando la respuesta del usuario..." }],
				details: { options: options.map((o, i) => ({ index: i + 1, label: o.label })) },
			});

			return withUILock(async () => {
				const response =
					mode === "single-select"
						? await askSingleChoice(ctx, params.question, context, options, correctIndices, explanation)
						: await askMultiChoice(ctx, params.question, context, options, correctIndices, explanation);
				if (!response) {
					return cancelledResult(params.question, mode, correctIndices, context);
				}
				return buildResult(params.question, context, mode, options, response, correctIndices, explanation);
			});
		},

		renderCall(args, theme) {
			// NOTE: never render correctAnswer or explanation here — it would leak
			// the answer into the transcript before the user responds. We also do NOT
			// enumerate the options here: they are shuffled at execute time, so any
			// order shown during streaming would be stale/misleading. The full option
			// list is rendered — in its true display order — by renderResult after the
			// user answers.
			// args may be partial while the model is still streaming them, so only
			// lenient parsing here (see partialOptionLabels).
			const count = partialOptionLabels(args.options).length;
			const question = typeof args.question === "string" ? args.question : "";
			let text = theme.fg("toolTitle", theme.bold("quiz ")) + theme.fg("muted", question);
			if (args.multiSelect) {
				text += theme.fg("dim", " [selección múltiple]");
			}
			if (count > 0) {
				const noun = count === 1 ? "opción" : "opciones";
				text += theme.fg("dim", ` (${count} ${noun})`);
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, _options, theme) {
			const details = result.details as QuizResultDetails | undefined;
			if (!details) {
				const first = result.content[0];
				return new Text(first?.type === "text" ? first.text : "", 0, 0);
			}

			if (details.status === "cancelled") {
				return new Text(theme.fg("warning", details.message || "Cancelado"), 0, 0);
			}
			if (details.status === "unavailable") {
				return new Text(theme.fg("warning", details.message || "quiz no disponible"), 0, 0);
			}

			const correctSet = new Set(details.correctIndices);
			const selectedSet = new Set(details.answers.map((a) => a.index));
			const lines: string[] = [];

			// Full option list in the true (shuffled) display order, with ✓/✗ marks.
			// Falls back to just the selected answers for older results that predate
			// details.options.
			const displayed =
				details.options && details.options.length > 0
					? details.options
					: details.answers.map((a) => ({ index: a.index, label: a.label }));

			for (const opt of displayed) {
				const isSelected = selectedSet.has(opt.index);
				const isKey = correctSet.has(opt.index);
				let mark: string;
				let body: string;
				if (details.dontKnow) {
					// No guess — only reveal the correct answer(s); never show ✗.
					mark = isKey ? theme.fg("success", "✓ ") : "  ";
					body = isKey ? theme.fg("success", `${opt.index}. ${opt.label}`) : theme.fg("dim", `${opt.index}. ${opt.label}`);
				} else if (isSelected && isKey) {
					mark = theme.fg("success", "✓ ");
					body = theme.fg("accent", `${opt.index}. ${opt.label}`);
				} else if (isSelected && !isKey) {
					mark = theme.fg("error", "✗ ");
					body = theme.fg("error", `${opt.index}. ${opt.label}`);
				} else if (!isSelected && isKey) {
					mark = theme.fg("success", "✓ ");
					body = theme.fg("success", `${opt.index}. ${opt.label}`);
				} else {
					mark = "  ";
					body = theme.fg("dim", `${opt.index}. ${opt.label}`);
				}
				lines.push(`${mark}${body}`);
			}

			lines.push("");
			const verdict = details.dontKnow
				? theme.fg("warning", "No lo sé")
				: details.correct
					? theme.fg("success", "¡Correcto!")
					: theme.fg("error", "Incorrecto");
			lines.push(verdict);

			if (details.note) {
				lines.push(theme.fg("muted", `Nota: ${details.note}`));
			}

			if (details.explanation) {
				lines.push(theme.fg("muted", details.explanation));
			}

			return new Text(lines.join("\n"), 0, 0);
		},
	});
}
