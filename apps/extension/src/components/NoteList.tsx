import {
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	pointerWithin,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ChevronDown, ChevronRight, Ghost } from "lucide-react";
import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { Note, NoteScope, NoteType } from "../hooks/useNotes";
import NoteItem from "./NoteItem";
import NoteSkeleton from "./NoteSkeleton";

const PAGE_SIZE = 20;

interface NoteListProps {
	scope?: "exact" | "domain" | "inbox";
	notes: Note[];
	loading: boolean;
	currentFullUrl: string;
	onUpdate: (
		id: string,
		content: string,
		type: NoteType,
		scope: NoteScope,
	) => Promise<boolean>;
	onDelete: (id: string) => Promise<boolean>;
	onToggleResolved: (
		id: string,
		status: boolean | undefined,
	) => Promise<boolean>;
	onToggleFavorite: (note: Note) => Promise<boolean>;
	onTogglePinned: (note: Note) => Promise<boolean>;
	onUpdateNoteOrder: (id: string, newOrder: number) => Promise<boolean>;
	onToggleExpansion: (id: string, current: boolean) => Promise<boolean>;
	showResolved?: boolean;
}

interface SortableWrapperProps {
	note: Note;
	children: (props: {
		setNodeRef: (node: HTMLElement | null) => void;
		style: React.CSSProperties;
		attributes: Record<string, unknown>;
		listeners: Record<string, unknown> | undefined;
	}) => React.ReactElement;
}

function SortableNoteItemWrapper({ note, children }: SortableWrapperProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: note.id });

	const style: React.CSSProperties = {
		transform: transform
			? `translate3d(${transform.x}px, ${transform.y}px, 0)`
			: undefined,
		transition,
		opacity: isDragging ? 0 : undefined,
	};

	return children({
		setNodeRef,
		style,
		attributes: attributes as unknown as Record<string, unknown>,
		listeners: listeners as unknown as Record<string, unknown>,
	});
}

function NoteList({
	scope = "exact",
	notes,
	loading,
	currentFullUrl,
	onUpdate,
	onDelete,
	onToggleResolved,
	onToggleFavorite,
	onTogglePinned,
	onUpdateNoteOrder,
	onToggleExpansion,
	showResolved = false,
}: NoteListProps) {
	const [_isSorting, setIsSorting] = useState(false);
	const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
	const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
	const [isEditDirty, setIsEditDirty] = useState(false);
	const [activeDragNote, setActiveDragNote] = useState<Note | null>(null);

	const [resolvingNoteIds, setResolvingNoteIds] = useState<Set<string>>(
		new Set(),
	);

	const sortedAllNotes = useMemo(() => {
		return [...notes].sort((a, b) => {
			if ((a.sort_order ?? 0) !== (b.sort_order ?? 0)) {
				return (a.sort_order ?? 0) - (b.sort_order ?? 0);
			}
			return (
				new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
			);
		});
	}, [notes]);

	const favoriteNotes = useMemo(() => {
		return sortedAllNotes.filter((n) => n.is_favorite);
	}, [sortedAllNotes]);

	const pinnedNotes = useMemo(() => {
		return sortedAllNotes.filter((n) => !n.is_favorite && n.is_pinned);
	}, [sortedAllNotes]);

	const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
	const observerRef = useRef<IntersectionObserver | null>(null);

	// ノート配列の変更時に表示件数を20件にリセット
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset visibleLimit whenever notes reference changes
	useEffect(() => {
		setVisibleLimit(PAGE_SIZE);
	}, [notes]);

	// スクロール監視と段階マウント（Callback Ref により DOM 出現時に確実にバインド、ドラッグ中はロック）
	const setSentinelRef = useCallback(
		(node: HTMLDivElement | null) => {
			if (observerRef.current) {
				observerRef.current.disconnect();
				observerRef.current = null;
			}

			if (!node || typeof IntersectionObserver === "undefined") return;

			const observer = new IntersectionObserver(
				(entries) => {
					const first = entries[0];
					if (first?.isIntersecting && !activeDragNote) {
						setVisibleLimit((prev) => prev + PAGE_SIZE);
					}
				},
				{ threshold: 0.1 },
			);

			observer.observe(node);
			observerRef.current = observer;
		},
		[activeDragNote],
	);

	useEffect(() => {
		return () => {
			if (observerRef.current) {
				observerRef.current.disconnect();
			}
		};
	}, []);

	const normalNotes = useMemo(() => {
		return sortedAllNotes.filter((n) => !n.is_favorite && !n.is_pinned);
	}, [sortedAllNotes]);

	const displayedNormalNotes = useMemo(() => {
		return normalNotes.slice(0, visibleLimit);
	}, [normalNotes, visibleLimit]);

	const handleDragStart = (event: DragStartEvent) => {
		const note = notes.find((n) => n.id === event.active.id);
		if (note) {
			setActiveDragNote(note);
		}
	};

	const handleDragCancel = () => {
		setActiveDragNote(null);
	};

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
	);

	const handleRequestEdit = useCallback(
		(id: string) => {
			if (id && editingNoteId && editingNoteId !== id && isEditDirty) {
				const confirmLeave = window.confirm(
					"You have unsaved changes in another note. Are you sure you want to discard them and edit this note?",
				);
				if (!confirmLeave) return;
			}
			setEditingNoteId(id);
			setIsEditDirty(false);
		},
		[editingNoteId, isEditDirty],
	);

	const handleToggleResolved = useCallback(
		async (id: string, currentStatus: boolean | undefined) => {
			const willBeResolved = !currentStatus;

			if (resolvingNoteIds.has(id)) return false;

			if (showResolved || !willBeResolved) {
				return await onToggleResolved(id, currentStatus);
			}

			setResolvingNoteIds((prev) => {
				const next = new Set(prev);
				next.add(id);
				return next;
			});

			setTimeout(async () => {
				try {
					await onToggleResolved(id, currentStatus);
				} catch (error) {
					console.error("Failed to toggle resolved status:", error);
				} finally {
					setResolvingNoteIds((current) => {
						if (!current.has(id)) return current;
						const next = new Set(current);
						next.delete(id);
						return next;
					});
				}
			}, 500);

			return true;
		},
		[resolvingNoteIds, showResolved, onToggleResolved],
	);

	const handleDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over) {
			handleDragCancel();
			return;
		}

		const activeNote = notes.find((n) => n.id === active.id);
		const overNote = notes.find((n) => n.id === over.id);

		if (!activeNote || !overNote) {
			handleDragCancel();
			return;
		}

		if (
			activeNote.is_favorite !== overNote.is_favorite ||
			activeNote.is_pinned !== overNote.is_pinned
		) {
			handleDragCancel();
			return;
		}

		const sectionNotes = sortedAllNotes.filter(
			(n) =>
				n.is_favorite === activeNote.is_favorite &&
				n.is_pinned === activeNote.is_pinned,
		);

		const activeSectionIndex = sectionNotes.findIndex(
			(n) => n.id === active.id,
		);
		const overSectionIndex = sectionNotes.findIndex((n) => n.id === over.id);

		if (
			activeSectionIndex === -1 ||
			overSectionIndex === -1 ||
			activeSectionIndex === overSectionIndex
		) {
			handleDragCancel();
			return;
		}

		const movedSectionNotes = arrayMove(
			sectionNotes,
			activeSectionIndex,
			overSectionIndex,
		);
		const finalIndex = movedSectionNotes.findIndex((n) => n.id === active.id);

		if (finalIndex === -1) {
			handleDragCancel();
			return;
		}

		let newOrder: number;
		const OFFSET = 0.0001;
		const EPSILON = 1e-9;

		if (finalIndex === 0) {
			const nextOrder = movedSectionNotes[1]?.sort_order ?? 0;
			newOrder = nextOrder - 1.0;
		} else if (finalIndex === movedSectionNotes.length - 1) {
			const prevOrder = movedSectionNotes[finalIndex - 1]?.sort_order ?? 0;
			newOrder = prevOrder + 1.0;
		} else {
			const prevOrder = movedSectionNotes[finalIndex - 1]?.sort_order ?? 0;
			const nextOrder = movedSectionNotes[finalIndex + 1]?.sort_order ?? 0;

			if (Math.abs(prevOrder - nextOrder) < EPSILON) {
				newOrder =
					activeSectionIndex > overSectionIndex
						? nextOrder - OFFSET
						: prevOrder + OFFSET;
			} else {
				newOrder = (prevOrder + nextOrder) / 2.0;
			}
		}

		setIsSorting(true);
		try {
			await onUpdateNoteOrder(active.id as string, newOrder);
		} catch (error) {
			console.error("Failed to update note order:", error);
		} finally {
			setIsSorting(false);
			handleDragCancel();
		}
	};

	if (loading && notes.length === 0) {
		return (
			<div className="space-y-3">
				{["skel-1", "skel-2", "skel-3"].map((key) => (
					<NoteSkeleton key={key} />
				))}
			</div>
		);
	}

	if (
		favoriteNotes.length === 0 &&
		pinnedNotes.length === 0 &&
		normalNotes.length === 0
	) {
		return (
			<div className="flex flex-col items-center justify-center py-10 text-center">
				<div className="bg-base-bg p-4 rounded-full mb-4">
					<Ghost className="w-8 h-8 text-muted-foreground" />
				</div>
				<h3 className="text-sm font-medium text-action mb-1">
					No notes for this page yet
				</h3>
				<p className="text-xs text-muted-foreground mb-4 max-w-50">
					Capture your thoughts for this page.
				</p>
			</div>
		);
	}

	const renderItem = (note: Note, isFavorite: boolean) => {
		const isResolving = resolvingNoteIds.has(note.id);
		return (
			<SortableNoteItemWrapper key={note.id} note={note}>
				{({ setNodeRef, style: sortableStyle, attributes, listeners }) => (
					<div ref={setNodeRef} style={sortableStyle}>
						<NoteItem
							note={note}
							currentFullUrl={currentFullUrl}
							isFavoriteList={isFavorite}
							isEditing={note.id === editingNoteId}
							onRequestEdit={handleRequestEdit}
							onSetIsEditDirty={setIsEditDirty}
							onUpdate={onUpdate}
							onDelete={onDelete}
							onToggleResolved={handleToggleResolved}
							onToggleFavorite={onToggleFavorite}
							onTogglePinned={onTogglePinned}
							onToggleExpansion={onToggleExpansion}
							isResolving={isResolving}
							sortableAttributes={attributes}
							sortableListeners={listeners}
						/>
					</div>
				)}
			</SortableNoteItemWrapper>
		);
	};

	return (
		<DndContext
			collisionDetection={pointerWithin}
			id={`extension-global-notes-dnd-context-${scope}`}
			onDragCancel={handleDragCancel}
			onDragEnd={handleDragEnd}
			onDragStart={handleDragStart}
			sensors={sensors}
		>
			<div className="space-y-4 relative">
				{/* --- 1. FAVORITES セクション --- */}
				{favoriteNotes.length > 0 && (
					<div className="space-y-3">
						<button
							type="button"
							onClick={() => setIsFavoritesOpen(!isFavoritesOpen)}
							className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 hover:text-action transition-colors cursor-pointer"
						>
							{isFavoritesOpen ? (
								<ChevronDown className="w-3 h-3" />
							) : (
								<ChevronRight className="w-3 h-3" />
							)}
							<span>FAVORITES ({favoriteNotes.length})</span>
						</button>
						<div className={isFavoritesOpen ? "block" : "hidden"}>
							<SortableContext
								items={favoriteNotes.map((n) => n.id)}
								strategy={verticalListSortingStrategy}
							>
								<div className="space-y-3">
									{favoriteNotes.map((note) => renderItem(note, true))}
								</div>
							</SortableContext>
						</div>
						{(pinnedNotes.length > 0 || normalNotes.length > 0) && (
							<hr className="border-base-border" />
						)}
					</div>
				)}

				{/* --- 2. PINNED セクション --- */}
				{pinnedNotes.length > 0 && (
					<div className="space-y-3">
						{favoriteNotes.length > 0 && (
							<div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
								<span>Current Page</span>
							</div>
						)}
						<SortableContext
							items={pinnedNotes.map((n) => n.id)}
							strategy={verticalListSortingStrategy}
						>
							<div className="space-y-3">
								{pinnedNotes.map((note) => renderItem(note, false))}
							</div>
						</SortableContext>
					</div>
				)}

				{/* --- 3. NORMAL セクション --- */}
				{normalNotes.length > 0 && (
					<div className="space-y-3">
						{favoriteNotes.length > 0 && pinnedNotes.length === 0 && (
							<div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
								<span>Current Page</span>
							</div>
						)}
						<SortableContext
							items={displayedNormalNotes.map((n) => n.id)}
							strategy={verticalListSortingStrategy}
						>
							<div className="space-y-3">
								{displayedNormalNotes.map((note) => renderItem(note, false))}
							</div>
						</SortableContext>
						{displayedNormalNotes.length < normalNotes.length && (
							<div
								ref={setSentinelRef}
								data-testid="infinite-scroll-sentinel"
								className="h-4 w-full"
								aria-hidden="true"
							/>
						)}
					</div>
				)}
			</div>

			<DragOverlay dropAnimation={null}>
				{activeDragNote ? (
					<div className="shadow-2xl scale-[1.02] rotate-1 transition-transform pointer-events-none border border-action/30 rounded-xl bg-base-bg">
						<NoteItem
							note={activeDragNote}
							currentFullUrl={currentFullUrl}
							isFavoriteList={activeDragNote.is_favorite}
							isEditing={false}
							onRequestEdit={() => {}}
							onSetIsEditDirty={() => {}}
							onUpdate={async () => false}
							onDelete={async () => false}
							onToggleResolved={async () => false}
							onToggleFavorite={async () => false}
							onTogglePinned={async () => false}
							onToggleExpansion={async () => false}
							isPreview={true}
						/>
					</div>
				) : null}
			</DragOverlay>
		</DndContext>
	);
}

export default React.memo(NoteList);
