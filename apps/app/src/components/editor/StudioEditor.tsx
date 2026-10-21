"use client";

import {
	Prec,
	type StateCommand,
	StateEffect,
	StateField,
} from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	EditorView,
	keymap,
	WidgetType,
} from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import React, { useEffect, useMemo, useRef } from "react";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { type EditorProps, editorExtensions } from "./EditorBase";
import { sitecueTheme } from "./sitecueTheme";

interface StudioEditorProps extends EditorProps {
	onGenerateHint?: (
		context: string,
		isExplicit?: boolean,
	) => Promise<string | null>;
}

export interface StudioEditorHandle {
	scrollToPos: (pos: number) => void;
}

// --- CM6 Hint Extension ---
const setHintEffect = StateEffect.define<{
	pos: number;
	text: string;
} | null>();

class HintWidget extends WidgetType {
	constructor(public text: string) {
		super();
	}
	toDOM() {
		const span = document.createElement("span");
		span.textContent = this.text;
		span.className = "text-neutral-400 italic pointer-events-none opacity-60";
		return span;
	}
}

const hintField = StateField.define<DecorationSet>({
	create: () => Decoration.none,
	update: (hints, tr) => {
		const nextHints = hints.map(tr.changes);
		for (const e of tr.effects) {
			if (e.is(setHintEffect)) {
				if (e.value === null) return Decoration.none;
				return Decoration.set([
					Decoration.widget({
						widget: new HintWidget(e.value.text),
						side: 1,
					}).range(e.value.pos),
				]);
			}
		}
		if (tr.docChanged) return Decoration.none;
		return nextHints;
	},
	provide: (f) => EditorView.decorations.from(f),
});

const basicSetupConfig = {
	lineNumbers: false,
	foldGutter: false,
};

const studioScrollPaddingTheme = EditorView.theme({
	".cm-scroller": {
		paddingBottom: "40vh",
	},
	".cm-content": {
		paddingBottom: "40vh",
	},
});

export const StudioEditor = React.forwardRef<
	StudioEditorHandle,
	StudioEditorProps
>(({ value, onChange, placeholder, isDirty = false, onGenerateHint }, ref) => {
	useUnsavedChanges(isDirty);

	const editorViewRef = useRef<EditorView | null>(null);

	React.useImperativeHandle(
		ref,
		() => ({
			scrollToPos: (pos: number) => {
				const view = editorViewRef.current;
				if (!view) return;
				view.dispatch({
					selection: { anchor: pos },
					effects: EditorView.scrollIntoView(pos, {
						y: "start",
						yMargin: 80,
					}),
				});
				view.focus();
			},
		}),
		[],
	);

	const onGenerateHintRef = useRef(onGenerateHint);
	useEffect(() => {
		onGenerateHintRef.current = onGenerateHint;
	}, [onGenerateHint]);

	const hintExtension = useMemo(() => {
		const requestHint = (view: EditorView) => {
			if (!onGenerateHintRef.current) return false;

			const pos = view.state.selection.main.head;
			const textBefore = view.state.sliceDoc(Math.max(0, pos - 500), pos);
			const initialDocLength = view.state.doc.length;

			onGenerateHintRef.current(textBefore, true).then((hintText) => {
				if (hintText && view.state.doc.length === initialDocLength) {
					view.dispatch({
						effects: [
							setHintEffect.of({
								pos: view.state.selection.main.head,
								text: hintText,
							}),
						],
					});
				}
			});
			return true;
		};

		const acceptHint: StateCommand = ({ state, dispatch }) => {
			const activeHints = state.field(hintField, false);
			if (!activeHints) return false;

			let accepted = false;
			activeHints.between(
				state.selection.main.head,
				state.selection.main.head,
				(from, _to, value) => {
					const widget = value.spec.widget as HintWidget;
					if (widget?.text) {
						dispatch(
							state.update({
								changes: { from, insert: widget.text },
								effects: [setHintEffect.of(null)],
							}),
						);
						accepted = true;
					}
				},
			);
			return accepted;
		};

		return [
			hintField,
			Prec.highest(
				keymap.of([
					{ key: "Mod-j", run: requestHint, preventDefault: true },
					{ key: "Alt-j", run: requestHint, preventDefault: true },
					{ key: "Tab", run: acceptHint },
					{
						key: "Escape",
						run: ({ state, dispatch }) => {
							dispatch(state.update({ effects: [setHintEffect.of(null)] }));
							return true;
						},
					},
				]),
			),
		];
	}, []);

	const extensions = React.useMemo(
		() => [
			...editorExtensions,
			...(Array.isArray(sitecueTheme) ? sitecueTheme : [sitecueTheme]),
			studioScrollPaddingTheme,
			...hintExtension,
		],
		[hintExtension],
	);

	return (
		<div className="w-full rounded-xl bg-base-surface/50 focus-within:bg-base-bg focus-within:shadow-sm border border-transparent focus-within:border-base-border transition-all duration-200 p-2 md:p-6">
			<CodeMirror
				onCreateEditor={(view) => {
					editorViewRef.current = view;
				}}
				value={value}
				onChange={onChange}
				extensions={extensions}
				placeholder={placeholder}
				basicSetup={basicSetupConfig}
				className="text-base"
				theme="light"
			/>
		</div>
	);
});

StudioEditor.displayName = "StudioEditor";
