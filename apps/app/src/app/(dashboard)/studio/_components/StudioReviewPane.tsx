"use client";

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Note, NoteType } from "@sitecue/shared";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import NoteEditor from "../../_components/NoteEditor";
import NoteCard from "./NoteCard";

interface StudioReviewPaneProps {
	reviewNotes: Note[];
	isLoadingReview: boolean;
	onAddNote: (content: string, type: NoteType) => Promise<void>;
	onUpdateNote: (id: string, content: string) => void;
	onUpdateNoteType?: (id: string, noteType: NoteType) => void;
	onToggleNoteResolved?: (id: string) => void;
	onDeleteNote: (id: string) => void;
	onDeleteAllNotes: () => void;
	onReorderNotes: (newOrder: Note[]) => void;
	onInsertToEditor: (content: string) => void;
	onWeave: () => void;
	isWeaving: boolean;
	onGenerateReview: () => Promise<void>;
	isGeneratingReview: boolean;
}

export default function StudioReviewPane({
	reviewNotes,
	isLoadingReview,
	onAddNote,
	onUpdateNote,
	onUpdateNoteType,
	onToggleNoteResolved,
	onDeleteNote,
	onDeleteAllNotes,
	onReorderNotes,
	onInsertToEditor,
	onWeave,
	isWeaving,
	onGenerateReview,
	isGeneratingReview,
}: StudioReviewPaneProps) {
	const [isAddNotesOpen, setIsAddNotesOpen] = useState(
		reviewNotes.length === 0,
	);

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 5,
			},
		}),
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		const oldIndex = reviewNotes.findIndex((item) => item.id === active.id);
		const newIndex = reviewNotes.findIndex((item) => item.id === over.id);

		const updatedNotes = arrayMove(reviewNotes, oldIndex, newIndex);
		onReorderNotes(updatedNotes);
	};

	return (
		<div className="relative flex h-full flex-col bg-neutral-50/30 overflow-hidden min-w-0 w-full">
			{/* 1. Add Notes フォーム: アコーディオン開閉対応 */}
			<div className="shrink-0 p-4 border-b border-neutral-200 bg-white/80 backdrop-blur-md z-20">
				<div className="flex justify-between items-center">
					<button
						type="button"
						onClick={() => setIsAddNotesOpen((prev) => !prev)}
						className="flex items-center gap-1.5 text-xs font-bold text-neutral-400 hover:text-action uppercase tracking-widest cursor-pointer select-none transition-colors"
					>
						<ChevronDown
							className={cn(
								"w-3.5 h-3.5 transition-transform duration-200",
								!isAddNotesOpen && "-rotate-90",
							)}
							aria-hidden="true"
						/>
						<span>Add Notes</span>
					</button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={onGenerateReview}
						disabled={isGeneratingReview}
						className={cn(
							"h-7 text-xs font-bold uppercase gap-1.5 rounded-full border-transparent shadow-none cursor-pointer transition-all duration-100 select-none text-action",
							"bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-pink-500/10",
							"hover-safe:bg-gradient-to-r hover-safe:from-purple-500/20 hover-safe:to-pink-500/20 hover-safe:scale-[1.01]",
							"active:scale-95",
						)}
					>
						{isGeneratingReview ? (
							<Loader2 className="w-3 h-3 animate-spin" />
						) : (
							<Sparkles className="w-3 h-3" />
						)}
						AI Review
					</Button>
				</div>
				{isAddNotesOpen && (
					<div className="mt-3 animate-fadeIn">
						<NoteEditor onSubmit={onAddNote} />
					</div>
				)}
			</div>

			{/* 2. Review Notes リスト: min-w-0 ガード */}
			<div className="flex-1 overflow-y-auto p-4 min-h-0 w-full min-w-0">
				<div className="flex justify-between items-center mb-3">
					<span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
						Review Notes ({reviewNotes.length})
					</span>
					{reviewNotes.length > 0 && (
						<AlertDialog>
							<AlertDialogTrigger
								render={
									<Button
										variant="ghost"
										size="sm"
										className="text-note-alert hover:bg-note-alert/10 hover:text-note-alert h-6 px-2 text-xs font-bold uppercase"
									>
										Delete All
									</Button>
								}
							/>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Delete all notes?</AlertDialogTitle>
									<AlertDialogDescription>
										This will remove all comments from this draft. You must
										click "Save" to apply these changes to the server.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction
										onClick={onDeleteAllNotes}
										className="bg-note-alert hover:bg-note-alert/90 text-white font-bold"
									>
										Delete
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					)}
				</div>

				<div className="grid grid-cols-[minmax(0,1fr)] gap-3 w-full min-w-0">
					{isLoadingReview ? (
						["skel-1", "skel-2", "skel-3"].map((skelKey) => (
							<div
								key={skelKey}
								className="h-24 animate-pulse rounded-xl border border-neutral-100 bg-neutral-100/50"
							/>
						))
					) : reviewNotes.length === 0 ? (
						<div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 px-4 py-8 text-center text-neutral-400">
							<p className="text-sm font-medium">
								No notes for this draft yet.
							</p>
							<p className="mt-1 text-[10px]">
								Use the form above to capture your thoughts.
							</p>
						</div>
					) : (
						<DndContext
							id="studio-review-dnd"
							sensors={sensors}
							collisionDetection={closestCenter}
							onDragEnd={handleDragEnd}
						>
							<SortableContext
								items={reviewNotes.map((n) => n.id)}
								strategy={verticalListSortingStrategy}
							>
								<div className="grid grid-cols-[minmax(0,1fr)] gap-3 w-full min-w-0">
									{reviewNotes.map((note) => (
										<SortableNoteCard
											key={note.id}
											note={note}
											onUpdate={onUpdateNote}
											onUpdateType={onUpdateNoteType}
											onToggleResolved={onToggleNoteResolved}
											onDelete={onDeleteNote}
											onInsert={onInsertToEditor}
										/>
									))}
								</div>
							</SortableContext>
						</DndContext>
					)}
				</div>
			</div>

			{/* Weave Action Bar */}
			<div className="shrink-0 p-4 border-t border-neutral-200/50 bg-white/80 backdrop-blur-md pb-safe">
				<div className="p-1 rounded-full bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-neutral-200/50">
					<Button
						type="button"
						onClick={onWeave}
						disabled={isWeaving}
						className={cn(
							"relative w-full flex items-center justify-center p-3 rounded-full font-bold cursor-pointer transition-all duration-300 active:scale-[0.98]",
							isWeaving
								? "bg-neutral-50 text-neutral-400 cursor-not-allowed"
								: "bg-action shadow-md hover-safe:opacity-90 hover-safe:scale-[1.005]",
						)}
					>
						<div className="flex items-center gap-3 pl-1 select-none">
							{isWeaving ? (
								<Loader2
									className="h-5 w-5 animate-spin text-neutral-400"
									aria-hidden="true"
								/>
							) : (
								<Sparkles
									className="h-5 w-5 text-indigo-200 shrink-0"
									aria-hidden="true"
								/>
							)}
							<span
								className={cn(
									"text-sm tracking-tight font-black transition-all",
									isWeaving
										? "text-neutral-400"
										: "bg-gradient-to-r from-purple-200 via-indigo-200 to-blue-200 bg-clip-text text-transparent",
								)}
							>
								{isWeaving ? "WEAVING..." : "WEAVE WITH AI"}
							</span>
						</div>
					</Button>
				</div>
			</div>
		</div>
	);
}

function SortableNoteCard({
	note,
	onUpdate,
	onUpdateType,
	onToggleResolved,
	onDelete,
	onInsert,
}: {
	note: Note;
	onUpdate: (id: string, content: string) => void;
	onUpdateType?: (id: string, noteType: NoteType) => void;
	onToggleResolved?: (id: string) => void;
	onDelete: (id: string) => void;
	onInsert: (content: string) => void;
}) {
	const {
		setNodeRef,
		transform,
		transition,
		isDragging,
		attributes,
		listeners,
	} = useSortable({
		id: note.id,
	});

	const style = {
		transform: CSS.Translate.toString(transform),
		transition,
		zIndex: isDragging ? 50 : undefined,
		position: "relative" as const,
	};

	return (
		<div ref={setNodeRef} style={style} className="min-w-0 w-full">
			<NoteCard
				note={note}
				onUpdate={onUpdate}
				onUpdateType={onUpdateType}
				onToggleResolved={onToggleResolved}
				onDelete={onDelete}
				onInsert={onInsert}
				hideScopeSelect={true}
				dragHandleProps={{ ...attributes, ...listeners }}
			/>
		</div>
	);
}
