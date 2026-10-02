import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Editor, Key, Text, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import { Type } from "@sinclair/typebox";
import { addWrapped, createEditorTheme, partialOptionLabels, withUILock } from "./_shared/ui.ts";

interface AskOption {
	label: string;
	value: string;
	description?: string;
}

interface DisplayOption extends AskOption {
	id: string;
	index?: number;
	isOther?: boolean;
	isSubmit?: boolean;
}

interface TextAnswer {
	type: "text";
	label: string;
	value: string;
}

interface OptionAnswer {
	type: "option";
	label: string;
	value: string;
	index: number;
}

interface OtherAnswer {
	type: "other";
	label: string;
	value: string;
}

type AskAnswer = TextAnswer | OptionAnswer | OtherAnswer;
type AskUserQuestionStatus = "answered" | "cancelled" | "unavailable";
type AskUserQuestionMode = "text" | "single-select" | "multi-select";

interface AskUserQuestionResultDetails {
	status: AskUserQuestionStatus;
	question: string;
	context?: string;
	mode: AskUserQuestionMode;
	answers: AskAnswer[];
	message?: string;
}

const OptionSchema = Type.Object({
	label: Type.String({
		description:
			'Etiqueta visible de la opción. Si recomiendas una opción, ponla primera y añade "(Recomendada)" al final de la etiqueta.',
	}),
	value: Type.Optional(
		Type.String({
			description: "Valor opcional legible por máquina devuelto para la opción. Por defecto, la etiqueta.",
		}),
	),
	description: Type.Optional(Type.String({ description: "Detalle extra opcional mostrado bajo la opción." })),
});

const AskUserQuestionParams = Type.Object({
	question: Type.String({
		description: "La única pregunta para el usuario. Exactamente una pregunta por llamada.",
	}),
	details: Type.Optional(
		Type.String({
			description: "Contexto o instrucciones extra opcionales mostrados bajo la pregunta.",
		}),
	),
	options: Type.Optional(
		Type.Array(OptionSchema, {
			description:
				"Opciones opcionales de opción múltiple. Omítelas o pasa un array vacío para respuesta de texto libre. Cuando hay opciones, el usuario siempre puede elegir Otra y escribir su propia respuesta.",
		}),
	),
	multiSelect: Type.Optional(
		Type.Boolean({
			description: "true para permitir marcar varias respuestas a la misma pregunta.",
		}),
	),
});

function normalizeOptions(options: Array<{ label: string; value?: string; description?: string }> | undefined): AskOption[] {
	return (options || [])
		.map((option) => ({
			label: option.label.trim(),
			value: option.value?.trim() || option.label.trim(),
			description: option.description?.trim() || undefined,
		}))
		.filter((option) => option.label.length > 0);
}

function getOtherLabel(options: AskOption[]): string {
	return options.some((option) => option.label.toLowerCase() === "otra") ? "Otra (personalizada)" : "Otra";
}

function formatAnswerForModel(answer: AskAnswer): string {
	switch (answer.type) {
		case "text":
			return answer.label;
		case "other":
			return `Otra: ${answer.label}`;
		case "option":
			return `${answer.index}. ${answer.label}`;
	}
}

function answerSortRank(answer: AskAnswer): number {
	switch (answer.type) {
		case "option":
			return answer.index;
		case "other":
			return Number.MAX_SAFE_INTEGER - 1;
		case "text":
			return Number.MAX_SAFE_INTEGER;
	}
}

function sortAnswers(answers: AskAnswer[]): AskAnswer[] {
	return [...answers].sort((a, b) => answerSortRank(a) - answerSortRank(b));
}

function buildStructuredResult(
	status: AskUserQuestionStatus,
	question: string,
	mode: AskUserQuestionMode,
	answers: AskAnswer[],
	context?: string,
	message?: string,
) {
	return {
		status,
		question,
		context,
		mode,
		answers,
		message,
	} as AskUserQuestionResultDetails;
}

function cancelledResult(question: string, mode: AskUserQuestionMode, context?: string) {
	const message = "El usuario canceló la pregunta";
	return {
		content: [{ type: "text" as const, text: message }],
		details: buildStructuredResult("cancelled", question, mode, [], context, message),
	};
}

function unavailableResult(question: string, mode: AskUserQuestionMode, message: string, context?: string) {
	return {
		content: [{ type: "text" as const, text: message }],
		details: buildStructuredResult("unavailable", question, mode, [], context, message),
	};
}

function buildResult(question: string, context: string | undefined, mode: AskUserQuestionMode, answers: AskAnswer[]) {
	let text: string;
	if (mode === "text") {
		const answer = answers[0];
		text = answer.label.trim().length > 0 ? `El usuario respondió: ${answer.label}` : "El usuario envió una respuesta vacía";
	} else if (mode === "single-select") {
		text = `El usuario eligió: ${formatAnswerForModel(answers[0])}`;
	} else {
		text = `El usuario eligió:\n${answers.map((answer) => `- ${formatAnswerForModel(answer)}`).join("\n")}`;
	}

	return {
		content: [{ type: "text" as const, text }],
		details: buildStructuredResult("answered", question, mode, answers, context),
	};
}

async function askSingleChoice(
	ctx: any,
	question: string,
	context: string | undefined,
	options: AskOption[],
): Promise<AskAnswer | null> {
	const otherLabel = getOtherLabel(options);
	const allOptions: DisplayOption[] = [
		...options.map((option, index) => ({ ...option, id: `option:${index}`, index: index + 1 })),
		{ id: "other", label: otherLabel, value: "__other__", isOther: true },
	];

	return ctx.ui.custom<AskAnswer | null>((tui: any, theme: any, _kb: any, done: (result: AskAnswer | null) => void) => {
		let optionIndex = 0;
		let editMode = false;
		let cachedLines: string[] | undefined;
		let cachedWidth = -1;
		const editor = new Editor(tui, createEditorTheme(theme));

		editor.onSubmit = (value) => {
			const trimmed = value.trim();
			if (!trimmed) return;
			done({ type: "other", label: trimmed, value: trimmed });
		};

		function refresh() {
			cachedLines = undefined;
			tui.requestRender();
		}

		function handleInput(data: string) {
			if (editMode) {
				if (matchesKey(data, Key.escape)) {
					editMode = false;
					editor.setText("");
					refresh();
					return;
				}
				editor.handleInput(data);
				refresh();
				return;
			}

			if (matchesKey(data, Key.up)) {
				optionIndex = Math.max(0, optionIndex - 1);
				refresh();
				return;
			}
			if (matchesKey(data, Key.down)) {
				optionIndex = Math.min(allOptions.length - 1, optionIndex + 1);
				refresh();
				return;
			}
			if (matchesKey(data, Key.enter)) {
				const selected = allOptions[optionIndex];
				if (selected.isOther) {
					editMode = true;
					editor.setText("");
					refresh();
					return;
				}
				done({
					type: "option",
					label: selected.label,
					value: selected.value,
					index: selected.index!,
				});
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

			add(theme.fg("accent", "─".repeat(width)));
			addWrapped(lines, theme.fg("text", ` ${question}`), width);
			if (context) {
				lines.push("");
				addWrapped(lines, theme.fg("muted", ` ${context}`), width);
			}
			lines.push("");

			for (let i = 0; i < allOptions.length; i++) {
				const option = allOptions[i];
				const selected = i === optionIndex;
				const prefix = selected ? theme.fg("accent", "> ") : "  ";
				const label = option.isOther ? option.label : `${option.index}. ${option.label}`;
				const styled = selected ? theme.fg("accent", label) : theme.fg("text", label);
				add(`${prefix}${styled}`);
				if (option.description) {
					addWrapped(lines, theme.fg("muted", option.description), width, "     ");
				}
			}

			if (editMode) {
				lines.push("");
				add(theme.fg("muted", " Escribe tu respuesta:"));
				for (const line of editor.render(Math.max(1, width - 2))) {
					add(` ${line}`);
				}
				lines.push("");
				add(theme.fg("dim", " Enter para enviar • Esc para volver"));
			} else {
				lines.push("");
				add(theme.fg("dim", " ↑↓ navegar • Enter elegir • Esc cancelar"));
			}

			add(theme.fg("accent", "─".repeat(width)));
			cachedLines = lines;
			cachedWidth = width;
			return lines;
		}

		return {
			render,
			invalidate: () => {
				cachedLines = undefined;
			},
			handleInput,
		};
	});
}

async function askMultiChoice(
	ctx: any,
	question: string,
	context: string | undefined,
	options: AskOption[],
): Promise<AskAnswer[] | null> {
	const otherLabel = getOtherLabel(options);
	const choiceItems: DisplayOption[] = options.map((option, index) => ({
		...option,
		id: `option:${index}`,
		index: index + 1,
	}));
	const submitItem: DisplayOption = { id: "submit", label: "Enviar", value: "__submit__", isSubmit: true };
	const allItems: DisplayOption[] = [
		...choiceItems,
		{ id: "other", label: otherLabel, value: "__other__", isOther: true },
		submitItem,
	];

	return ctx.ui.custom<AskAnswer[] | null>((tui: any, theme: any, _kb: any, done: (result: AskAnswer[] | null) => void) => {
		let optionIndex = 0;
		let editMode = false;
		let cachedLines: string[] | undefined;
		let cachedWidth = -1;
		const selected = new Map<string, AskAnswer>();
		const editor = new Editor(tui, createEditorTheme(theme));

		editor.onSubmit = (value) => {
			const trimmed = value.trim();
			if (!trimmed) return;
			selected.set("other", { type: "other", label: trimmed, value: trimmed });
			editMode = false;
			refresh();
		};

		function refresh() {
			cachedLines = undefined;
			tui.requestRender();
		}

		function toggleOption(item: DisplayOption) {
			if (selected.has(item.id)) {
				selected.delete(item.id);
			} else {
				selected.set(item.id, {
					type: "option",
					label: item.label,
					value: item.value,
					index: item.index!,
				});
			}
			refresh();
		}

		function handleInput(data: string) {
			if (editMode) {
				if (matchesKey(data, Key.escape)) {
					editMode = false;
					editor.setText(selected.get("other")?.label || "");
					refresh();
					return;
				}
				editor.handleInput(data);
				refresh();
				return;
			}

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
				if (current.isOther) {
					if (selected.has("other")) {
						selected.delete("other");
						refresh();
					} else {
						editMode = true;
						editor.setText("");
						refresh();
					}
					return;
				}
				toggleOption(current);
				return;
			}

			if (matchesKey(data, Key.enter)) {
				if (current.isSubmit) {
					if (selected.size > 0) {
						done(sortAnswers(Array.from(selected.values())));
					}
					return;
				}
				if (current.isOther) {
					editMode = true;
					editor.setText(selected.get("other")?.label || "");
					refresh();
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

			add(theme.fg("accent", "─".repeat(width)));
			addWrapped(lines, theme.fg("text", ` ${question}`), width);
			if (context) {
				lines.push("");
				addWrapped(lines, theme.fg("muted", ` ${context}`), width);
			}
			lines.push("");

			for (let i = 0; i < allItems.length; i++) {
				const item = allItems[i];
				const isFocused = i === optionIndex;
				const prefix = isFocused ? theme.fg("accent", "> ") : "  ";

				if (item.isSubmit) {
					const label = selected.size > 0 ? `✓ ${item.label} (${selected.size} marcadas)` : `○ ${item.label}`;
					const styled = isFocused
						? theme.fg("accent", label)
						: theme.fg(selected.size > 0 ? "success" : "dim", label);
					add(`${prefix}${styled}`);
					continue;
				}

				if (item.isOther) {
					const other = selected.get("other");
					const marker = other ? "[x]" : "[ ]";
					const suffix = other ? ` — ${other.label}` : "";
					const styled = isFocused
						? theme.fg("accent", `${marker} ${item.label}${suffix}`)
						: theme.fg(other ? "success" : "text", `${marker} ${item.label}${suffix}`);
					add(`${prefix}${styled}`);
					continue;
				}

				const checked = selected.has(item.id);
				const marker = checked ? "[x]" : "[ ]";
				const label = `${marker} ${item.index}. ${item.label}`;
				const styled = isFocused
					? theme.fg("accent", label)
					: theme.fg(checked ? "success" : "text", label);
				add(`${prefix}${styled}`);
				if (item.description) {
					addWrapped(lines, theme.fg("muted", item.description), width, "     ");
				}
			}

			if (editMode) {
				lines.push("");
				add(theme.fg("muted", " Escribe tu respuesta:"));
				for (const line of editor.render(Math.max(1, width - 2))) {
					add(` ${line}`);
				}
				lines.push("");
				add(theme.fg("dim", " Enter para guardar • Esc para volver"));
			} else {
				lines.push("");
				if (selected.size === 0) {
					add(theme.fg("warning", " Marca al menos una respuesta antes de enviar."));
				}
				add(theme.fg("dim", " ↑↓ navegar • Espacio/Enter marcar • Enter en Otra para escribir, en Enviar para enviar • Esc cancelar"));
			}

			add(theme.fg("accent", "─".repeat(width)));
			cachedLines = lines;
			cachedWidth = width;
			return lines;
		}

		return {
			render,
			invalidate: () => {
				cachedLines = undefined;
			},
			handleInput,
		};
	});
}

export default function askUserQuestion(pi: ExtensionAPI) {
	pi.registerTool({
		name: "ask_user_question",
		label: "ask_user_question",
		description:
			"Hace una única pregunta al usuario y pausa la ejecución hasta que responda. Úsala cuando los requisitos sean ambiguos, necesites una preferencia, una decisión cambie materialmente el resultado o necesites confirmación antes de seguir. Exactamente una pregunta por llamada; mejor varias llamadas separadas que agrupar preguntas no relacionadas.",
		promptSnippet:
			"Usa esta herramienta para hacer exactamente una pregunta aclaratoria, de requisito, de preferencia o de decisión antes de continuar.",
		promptGuidelines: [
			"Escribe la pregunta y las opciones SIEMPRE en castellano.",
			"Exactamente una pregunta por llamada.",
			"Si necesitas respuesta a varias preguntas, haz varias llamadas separadas a ask_user_question en vez de combinarlas.",
			'Cuando hay opciones, el usuario siempre puede elegir "Otra" y escribir su propia respuesta.',
			"Usa multiSelect: true solo cuando necesites varias respuestas a la misma pregunta.",
			'Si recomiendas una opción, ponla primera y añade "(Recomendada)" al final de la etiqueta.',
			"Prefiere esta herramienta a adivinar cuando requisitos, preferencias o decisiones no estén claros.",
			"Úsala cuando haya varios caminos válidos y el preferido dependa de la elección del usuario.",
		],
		parameters: AskUserQuestionParams,

		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const options = normalizeOptions(params.options);
			const context = params.details?.trim() || undefined;
			const mode: AskUserQuestionMode = options.length === 0 ? "text" : params.multiSelect ? "multi-select" : "single-select";

			if (signal?.aborted) {
				return cancelledResult(params.question, mode, context);
			}

			if (!ctx.hasUI) {
				return unavailableResult(params.question, mode, "ask_user_question necesita la UI del modo interactivo", context);
			}

			return withUILock(async () => {
				if (mode === "text") {
					const editorTitle = context ? `${params.question}\n\n${context}` : params.question;
					const answer = await ctx.ui.editor(editorTitle);
					if (answer === undefined) {
						return cancelledResult(params.question, mode, context);
					}
					return buildResult(params.question, context, mode, [
						{ type: "text", label: answer.trim(), value: answer.trim() },
					]);
				}

				if (mode === "single-select") {
					const answer = await askSingleChoice(ctx, params.question, context, options);
					if (!answer) {
						return cancelledResult(params.question, mode, context);
					}
					return buildResult(params.question, context, mode, [answer]);
				}

				const answers = await askMultiChoice(ctx, params.question, context, options);
				if (!answers) {
					return cancelledResult(params.question, mode, context);
				}
				return buildResult(params.question, context, mode, answers);
			});
		},

		renderCall(args, theme) {
			// args may be partial while the model is still streaming them, so only
			// lenient parsing here (see partialOptionLabels).
			const labels = partialOptionLabels(args.options);
			const question = typeof args.question === "string" ? args.question : "";
			let text = theme.fg("toolTitle", theme.bold("ask_user_question ")) + theme.fg("muted", question);
			if (args.multiSelect) {
				text += theme.fg("dim", " [selección múltiple]");
			}
			if (labels.length > 0) {
				const otherLabel = labels.some((l) => l.toLowerCase() === "otra") ? "Otra (personalizada)" : "Otra";
				text += `\n${theme.fg("dim", `  Opciones: ${[...labels, otherLabel].join(", ")}`)}`;
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, _options, theme) {
			const details = result.details as AskUserQuestionResultDetails | undefined;
			if (!details) {
				const first = result.content[0];
				return new Text(first?.type === "text" ? first.text : "", 0, 0);
			}

			if (details.status === "cancelled") {
				return new Text(theme.fg("warning", details.message || "Cancelado"), 0, 0);
			}

			if (details.status === "unavailable") {
				return new Text(theme.fg("warning", details.message || "ask_user_question no disponible"), 0, 0);
			}

			const lines = details.answers.map((answer) => {
				switch (answer.type) {
					case "text":
						return `${theme.fg("success", "✓ ")}${theme.fg("accent", answer.label || "(respuesta vacía)")}`;
					case "other":
						return `${theme.fg("success", "✓ ")}${theme.fg("muted", "Otra: ")}${theme.fg("accent", answer.label)}`;
					case "option":
						return `${theme.fg("success", "✓ ")}${theme.fg("accent", `${answer.index}. ${answer.label}`)}`;
				}
			});
			return new Text(lines.join("\n"), 0, 0);
		},
	});
}
