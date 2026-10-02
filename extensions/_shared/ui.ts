/**
 * Helpers shared by the pop-up tools (quiz, ask_user_question).
 *
 * Lives in a subdirectory WITHOUT an index.ts, so pi's extension discovery
 * (top-level *.ts files and `<dir>/index.ts`) never loads it as an extension —
 * it is only imported.
 */

import { type EditorTheme, truncateToWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

export function createEditorTheme(theme: any): EditorTheme {
	return {
		borderColor: (s) => theme.fg("accent", s),
		selectList: {
			selectedPrefix: (t) => theme.fg("accent", t),
			selectedText: (t) => theme.fg("accent", t),
			description: (t) => theme.fg("muted", t),
			scrollInfo: (t) => theme.fg("dim", t),
			noMatch: (t) => theme.fg("warning", t),
		},
	};
}

export function addWrapped(lines: string[], text: string, width: number, indent = ""): void {
	const contentWidth = Math.max(1, width - indent.length);
	for (const line of wrapTextWithAnsi(text, contentWidth)) {
		lines.push(truncateToWidth(`${indent}${line}`, width));
	}
}

/**
 * Lenient option normalization for renderCall. pi re-renders the call while the
 * model is still streaming its arguments, so options can arrive half-built
 * (missing or non-string `label`). Never throw here — a throw inside a render
 * breaks the TUI. Strict validation belongs in execute().
 */
export function partialOptionLabels(options: unknown): string[] {
	if (!Array.isArray(options)) return [];
	return options
		.map((o) => (o && typeof o === "object" && typeof (o as any).label === "string" ? (o as any).label.trim() : ""))
		.filter((label) => label.length > 0);
}

// Shared UI mutex. ctx.ui.custom()/editor can only handle one active call at
// a time, so ALL pop-up-style tools (quiz, ask_user_question, ...) must
// serialize against each other, not just against themselves. The mutex is
// stashed on globalThis because pi may load each extension file with its own
// module instance, so a plain module-level variable would not be shared.
const SHARED_UI_LOCK_KEY = "__piSharedUiLock";

function getSharedUiLock() {
	const g = globalThis as any;
	if (!g[SHARED_UI_LOCK_KEY]) {
		let chain: Promise<void> = Promise.resolve();
		g[SHARED_UI_LOCK_KEY] = {
			withLock<T>(fn: () => T | Promise<T>): Promise<T> {
				const prev = chain;
				let release: () => void;
				chain = new Promise<void>((r) => {
					release = r;
				});
				return prev.then(fn).finally(() => release!());
			},
		};
	}
	return g[SHARED_UI_LOCK_KEY] as { withLock<T>(fn: () => T | Promise<T>): Promise<T> };
}

export function withUILock<T>(fn: () => Promise<T>): Promise<T> {
	return getSharedUiLock().withLock(fn);
}
