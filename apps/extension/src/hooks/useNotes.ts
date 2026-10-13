import type { Note, ViewScope as NoteScope } from "@sitecue/shared";
import {
	createNoteEntity,
	deleteNoteEntity,
	fetchExtensionFavoriteContents,
	fetchExtensionFavoriteMetadatas,
	fetchExtensionInboxContents,
	fetchExtensionInboxMetadatas,
	fetchExtensionNoteContents,
	fetchExtensionNoteMetadatas,
	getScopeUrls,
	resolveNotePayload,
	updateNoteEntity,
} from "@sitecue/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { localClient, supabase } from "../supabaseClient";
import type { AuthStatus } from "./useAuth";

export type NoteType = Note["note_type"];
export type { Note, NoteScope };

const sortNotesConsistent = (a: Note, b: Note) => {
	if ((a.sort_order ?? 0) !== (b.sort_order ?? 0)) {
		return (a.sort_order ?? 0) - (b.sort_order ?? 0);
	}
	return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
};

export function useNotes(
	authStatus: AuthStatus,
	currentFullUrl: string,
	setTotalNoteCount: React.Dispatch<React.SetStateAction<number>>,
	viewScope: "exact" | "domain" | "inbox",
) {
	const [pageNotes, setPageNotes] = useState<Note[]>([]);
	const [inboxNotes, setInboxNotes] = useState<Note[]>([]);
	const [favoriteNotes, setFavoriteNotes] = useState<Note[]>([]);
	const [loading, setLoading] = useState(false);
	const [isInboxLoading, setIsInboxLoading] = useState(false);
	const [processingNoteIds, setProcessingNoteIds] = useState<Set<string>>(
		new Set(),
	);

	const session =
		authStatus.mode === "authenticated" ? authStatus.session : null;
	const client = authStatus.mode === "guest" ? localClient : supabase;

	const hasInitialPageFetchRef = useRef(false);
	const hasFetchedFavoritesRef = useRef(false);
	const hasFetchedInboxRef = useRef(false);
	const isFetchingInboxRef = useRef(false);

	// お気に入りノートの本文 Hydration
	const hydrateFavoriteContent = useCallback(async () => {
		if (authStatus.mode === "loading") return;
		try {
			const data = await fetchExtensionFavoriteContents(
				client as unknown as typeof supabase,
			);
			if (data) {
				setFavoriteNotes((prevNotes) =>
					prevNotes.map((note) => {
						const hydrated = data.find((d) => d.id === note.id);
						return hydrated ? { ...note, content: hydrated.content } : note;
					}),
				);
			}
		} catch (error) {
			console.error("Failed to hydrate favorite notes", error);
		}
	}, [authStatus.mode, client]);

	// お気に入りノートのフェッチ（初期ロード時に1回のみ。URL移動では再フェッチしない）
	const fetchFavoriteNotes = useCallback(async () => {
		if (authStatus.mode === "loading" || hasFetchedFavoritesRef.current) return;
		try {
			const data = await fetchExtensionFavoriteMetadatas(
				client as unknown as typeof supabase,
			);
			setFavoriteNotes(data || []);
			hasFetchedFavoritesRef.current = true;
			hydrateFavoriteContent();
		} catch (error) {
			console.error("Failed to fetch favorite notes", error);
		}
	}, [authStatus.mode, hydrateFavoriteContent, client]);

	useEffect(() => {
		fetchFavoriteNotes();
	}, [fetchFavoriteNotes]);

	// Page/Domain ノートの Hydration
	const hydratePageContent = useCallback(async () => {
		if (!currentFullUrl || authStatus.mode === "loading") return;
		try {
			const scopeUrls = getScopeUrls(currentFullUrl);
			const data = await fetchExtensionNoteContents(
				client as unknown as typeof supabase,
				scopeUrls,
				{ includeInbox: false },
			);

			if (data) {
				setPageNotes((prevNotes) =>
					prevNotes.map((note) => {
						const hydrated = data.find((d) => d.id === note.id);
						return hydrated ? { ...note, content: hydrated.content } : note;
					}),
				);
			}
		} catch (error) {
			console.error("Failed to hydrate page notes", error);
		}
	}, [currentFullUrl, authStatus.mode, client]);

	// Page/Domain ノートのフェッチ（URL変更でトリガー）
	const fetchPageNotes = useCallback(async () => {
		if (!currentFullUrl || authStatus.mode === "loading") return;

		if (authStatus.mode !== "guest" && !hasInitialPageFetchRef.current) {
			setLoading(true);
		}

		try {
			const scopeUrls = getScopeUrls(currentFullUrl);
			const data = await fetchExtensionNoteMetadatas(
				client as unknown as typeof supabase,
				scopeUrls,
				{ includeInbox: false },
			);

			setPageNotes((prevNotes) => {
				return (data || []).map((newNote) => {
					const existing = prevNotes.find((n) => n.id === newNote.id);
					return existing?.content
						? ({ ...newNote, content: existing.content } as Note)
						: (newNote as Note);
				});
			});

			hydratePageContent();
		} catch (error) {
			console.error("Failed to fetch page notes", error);
		} finally {
			hasInitialPageFetchRef.current = true;
			setLoading(false);
		}
	}, [currentFullUrl, authStatus.mode, hydratePageContent, client]);

	// Inbox ノートのオンデマンドフェッチ & Hydration
	const fetchInboxNotes = useCallback(async () => {
		if (authStatus.mode === "loading" || isFetchingInboxRef.current) return;
		isFetchingInboxRef.current = true;
		setIsInboxLoading(true);

		try {
			const metadatas = await fetchExtensionInboxMetadatas(
				client as unknown as typeof supabase,
			);
			setInboxNotes((prevNotes) => {
				return (metadatas || []).map((newNote) => {
					const existing = prevNotes.find((n) => n.id === newNote.id);
					return existing?.content
						? ({ ...newNote, content: existing.content } as Note)
						: (newNote as Note);
				});
			});

			const contents = await fetchExtensionInboxContents(
				client as unknown as typeof supabase,
			);
			if (contents) {
				setInboxNotes((prevNotes) =>
					prevNotes.map((note) => {
						const hydrated = contents.find((d) => d.id === note.id);
						return hydrated ? { ...note, content: hydrated.content } : note;
					}),
				);
			}
			hasFetchedInboxRef.current = true;
		} catch (error) {
			console.error("Failed to fetch inbox notes", error);
		} finally {
			isFetchingInboxRef.current = false;
			setIsInboxLoading(false);
		}
	}, [authStatus.mode, client]);

	// URL変更監視: Pageノートのみ再フェッチ。Inboxとお気に入りキャッシュは温存。
	useEffect(() => {
		fetchPageNotes();
	}, [fetchPageNotes]);

	// viewScope 監視: Inbox 初回アクセス時にオンデマンドフェッチ
	useEffect(() => {
		if (viewScope === "inbox" && !hasFetchedInboxRef.current) {
			fetchInboxNotes();
		}
	}, [viewScope, fetchInboxNotes]);

	// 💡 Map による厳密なID重複排除マージ (お気に入り ➔ Inbox ➔ Page の順で上書きし最新状態を担保)
	const notes = useMemo(() => {
		const noteMap = new Map<string, Note>();
		for (const n of favoriteNotes) noteMap.set(n.id, n);
		for (const n of inboxNotes) noteMap.set(n.id, n);
		for (const n of pageNotes) noteMap.set(n.id, n);
		return Array.from(noteMap.values()).sort(sortNotesConsistent);
	}, [favoriteNotes, inboxNotes, pageNotes]);

	// CRUD ヘルパー
	const updateLocalNoteState = (
		updater: (prev: Note[]) => Note[],
		scope: NoteScope,
	) => {
		if (scope === "inbox") {
			setInboxNotes(updater);
		} else {
			setPageNotes(updater);
		}
		setFavoriteNotes((prev) => updater(prev).filter((n) => n.is_favorite));
	};

	const addNote = async (
		content: string,
		selectedScope: NoteScope,
		selectedType: NoteType,
	) => {
		if (authStatus.mode === "loading" || !content.trim()) return false;

		if (
			authStatus.mode === "guest" &&
			notes.filter((n) => n.scope !== "inbox").length >= 50
		) {
			toast.error(
				"Note storage limit reached (Max 50 notes). Please sign in for unlimited cloud sync.",
			);
			return false;
		}

		const currentUserId =
			authStatus.mode === "guest" ? "guest-user" : session?.user?.id;
		if (!currentUserId) return false;

		const resolved = resolveNotePayload({
			content,
			note_type: selectedType,
			scope: selectedScope,
			currentUrl: currentFullUrl,
		});

		const targetList = selectedScope === "inbox" ? inboxNotes : pageNotes;
		const newSortOrder =
			targetList.length > 0
				? Math.min(...targetList.map((n) => n.sort_order || 0)) - 1.0
				: 0.0;

		const tempId = crypto.randomUUID();
		const tempNote = {
			id: tempId,
			user_id: currentUserId,
			url_pattern: resolved.url_pattern,
			content: resolved.content,
			scope: resolved.scope,
			note_type: resolved.note_type,
			sort_order: newSortOrder,
			created_at: new Date().toISOString(),
			is_expanded: false,
			is_favorite: false,
			is_pinned: false,
			is_resolved: false,
			tags: resolved.tags,
		} as Note;

		updateLocalNoteState(
			(prev) => [...prev, tempNote].sort(sortNotesConsistent),
			selectedScope,
		);

		try {
			let data: Note;
			if (authStatus.mode === "guest") {
				const guestClient = client as unknown as typeof localClient;
				if (typeof guestClient.from === "function") {
					try {
						await (guestClient
							.from("sitecue_notes")
							.insert(tempNote) as unknown as Promise<unknown>);
					} catch (e) {
						console.warn("localClient insertion fell back", e);
					}
				}
				data = tempNote;
			} else {
				data = await createNoteEntity(
					client as unknown as typeof supabase,
					currentUserId,
					{
						content,
						note_type: selectedType,
						scope: selectedScope,
						currentUrl: currentFullUrl,
					},
				);
			}

			updateLocalNoteState(
				(prev) =>
					prev
						.map((n) => (n.id === tempId ? data : n))
						.sort(sortNotesConsistent),
				selectedScope,
			);

			if (selectedScope !== "inbox") {
				setTotalNoteCount((prev) => prev + 1);
			}
			chrome.runtime.sendMessage({ type: "REFRESH_BADGE" });
			return true;
		} catch (error) {
			console.error("Failed to create note", error);
			updateLocalNoteState(
				(prev) => prev.filter((n) => n.id !== tempId),
				selectedScope,
			);
			toast.error("Failed to create note");
			return false;
		}
	};

	const updateNote = async (
		id: string,
		editContent: string,
		editType: NoteType,
		editScope?: NoteScope,
	) => {
		if (!editContent.trim()) return false;
		const existingNote = notes.find((n) => n.id === id);
		if (!existingNote) return false;

		const targetScope = editScope ?? existingNote.scope;

		try {
			let data: Note;
			if (authStatus.mode === "guest") {
				const resolved = resolveNotePayload({
					content: editContent,
					note_type: editType,
					scope: targetScope,
					currentUrl: currentFullUrl,
				});

				const updatedNote = {
					...existingNote,
					content: editContent,
					note_type: editType,
					scope: targetScope,
					url_pattern: resolved.url_pattern,
					tags: resolved.tags,
					updated_at: new Date().toISOString(),
				} as Note;

				const guestClient = client as unknown as typeof localClient;
				if (typeof guestClient.from === "function") {
					try {
						await (guestClient
							.from("sitecue_notes")
							.update(updatedNote)
							.eq("id", id) as unknown as Promise<unknown>);
					} catch (e) {
						console.warn("localClient update fell back", e);
					}
				}
				data = updatedNote;
			} else {
				data = await updateNoteEntity(
					client as unknown as typeof supabase,
					id,
					{
						content: editContent,
						note_type: editType,
						scope: editScope,
						currentUrl: currentFullUrl,
					},
				);
			}

			if (existingNote.scope !== data.scope) {
				if (existingNote.scope === "inbox") {
					setInboxNotes((prev) => prev.filter((n) => n.id !== id));
					setPageNotes((prev) => [...prev, data].sort(sortNotesConsistent));
				} else {
					setPageNotes((prev) => prev.filter((n) => n.id !== id));
					setInboxNotes((prev) => [...prev, data].sort(sortNotesConsistent));
				}
			} else {
				updateLocalNoteState(
					(prev) => prev.map((n) => (n.id === id ? data : n)),
					data.scope,
				);
			}

			setFavoriteNotes((prev) =>
				prev.map((n) => (n.id === id ? { ...n, ...data } : n)),
			);

			chrome.runtime.sendMessage({ type: "REFRESH_BADGE" });
			return true;
		} catch (error: unknown) {
			console.error("Failed to update note", error);
			let errorMsg = "Failed to update note";
			if (typeof error === "object" && error !== null && "message" in error) {
				const msg = String((error as { message: unknown }).message);
				if (
					msg.includes("sitecue_notes_content_len_check") ||
					msg.includes("length") ||
					msg.includes("limit")
				) {
					errorMsg =
						"Failed to save: Content exceeds the 10,000 character limit.";
				}
			}
			toast.error(errorMsg);
			return false;
		}
	};

	const deleteNote = async (id: string) => {
		if (!window.confirm("このメモを削除しますか？")) return false;
		const noteToDelete = notes.find((n) => n.id === id);
		if (!noteToDelete) return false;

		try {
			await deleteNoteEntity(client as unknown as typeof supabase, id);

			updateLocalNoteState(
				(prev) => prev.filter((note) => note.id !== id),
				noteToDelete.scope,
			);
			setFavoriteNotes((prev) => prev.filter((n) => n.id !== id));

			if (noteToDelete.scope !== "inbox") {
				setTotalNoteCount((prev) => Math.max(0, prev - 1));
				chrome.runtime.sendMessage({ type: "REFRESH_BADGE" });
			}
			return true;
		} catch (error) {
			console.error("Failed to delete note", error);
			toast.error("Failed to delete note");
			return false;
		}
	};

	const toggleResolved = async (
		id: string,
		currentStatus: boolean | undefined,
	) => {
		const nextStatus = !currentStatus;
		const targetNote = notes.find((n) => n.id === id);
		if (!targetNote) return false;

		try {
			if (authStatus.mode === "guest") {
				const guestClient = client as unknown as typeof localClient;
				if (typeof guestClient.from === "function") {
					try {
						await (guestClient
							.from("sitecue_notes")
							.update({ is_resolved: nextStatus })
							.eq("id", id) as unknown as Promise<unknown>);
					} catch (e) {
						console.warn("localClient toggleResolved fell back", e);
					}
				}
			} else {
				await updateNoteEntity(client as unknown as typeof supabase, id, {
					is_resolved: nextStatus,
				});
			}

			updateLocalNoteState(
				(prev) =>
					prev.map((n) =>
						n.id === id ? { ...n, is_resolved: nextStatus } : n,
					),
				targetNote.scope,
			);
			setFavoriteNotes((prev) =>
				prev.map((n) => (n.id === id ? { ...n, is_resolved: nextStatus } : n)),
			);
			chrome.runtime.sendMessage({ type: "REFRESH_BADGE" });
			return true;
		} catch (error) {
			console.error("Failed to toggle resolved status", error);
			toast.error("Failed to update status");
			return false;
		}
	};

	const toggleFavorite = async (note: Note) => {
		const nextStatus = !note.is_favorite;
		const updatedNote = { ...note, is_favorite: nextStatus };

		// 0ms 楽観的UI更新
		setFavoriteNotes((prev) => {
			if (nextStatus) {
				const exists = prev.some((n) => n.id === note.id);
				return exists
					? prev.map((n) => (n.id === note.id ? updatedNote : n))
					: [...prev, updatedNote];
			}
			return prev.filter((n) => n.id !== note.id);
		});

		if (note.scope === "inbox") {
			setInboxNotes((prev) =>
				prev.map((n) => (n.id === note.id ? updatedNote : n)),
			);
		} else {
			setPageNotes((prev) =>
				prev.map((n) => (n.id === note.id ? updatedNote : n)),
			);
		}

		try {
			if (authStatus.mode === "guest") {
				const guestClient = client as unknown as typeof localClient;
				if (typeof guestClient.from === "function") {
					try {
						await (guestClient
							.from("sitecue_notes")
							.update({ is_favorite: nextStatus })
							.eq("id", note.id) as unknown as Promise<unknown>);
					} catch (e) {
						console.warn("localClient toggleFavorite fell back", e);
					}
				}
			} else {
				await updateNoteEntity(client as unknown as typeof supabase, note.id, {
					is_favorite: nextStatus,
				});
			}
			return true;
		} catch (error) {
			console.error("Failed to toggle favorite status", error);
			// ロールバック
			setFavoriteNotes((prev) => {
				if (note.is_favorite) {
					return prev.some((n) => n.id === note.id) ? prev : [...prev, note];
				}
				return prev.filter((n) => n.id !== note.id);
			});
			if (note.scope === "inbox") {
				setInboxNotes((prev) => prev.map((n) => (n.id === note.id ? note : n)));
			} else {
				setPageNotes((prev) => prev.map((n) => (n.id === note.id ? note : n)));
			}
			toast.error("Failed to update status");
			return false;
		}
	};

	const togglePinned = async (note: Note) => {
		const nextStatus = !note.is_pinned;
		try {
			if (authStatus.mode === "guest") {
				const guestClient = client as unknown as typeof localClient;
				if (typeof guestClient.from === "function") {
					try {
						await (guestClient
							.from("sitecue_notes")
							.update({ is_pinned: nextStatus })
							.eq("id", note.id) as unknown as Promise<unknown>);
					} catch (e) {
						console.warn("localClient togglePinned fell back", e);
					}
				}
			} else {
				await updateNoteEntity(client as unknown as typeof supabase, note.id, {
					is_pinned: nextStatus,
				});
			}

			updateLocalNoteState(
				(prev) =>
					prev.map((n) =>
						n.id === note.id ? { ...n, is_pinned: nextStatus } : n,
					),
				note.scope,
			);
			setFavoriteNotes((prev) =>
				prev.map((n) =>
					n.id === note.id ? { ...n, is_pinned: nextStatus } : n,
				),
			);
			return true;
		} catch (error) {
			console.error("Failed to toggle pinned status", error);
			toast.error("Failed to update status");
			return false;
		}
	};

	const updateNoteOrder = async (id: string, newOrder: number) => {
		if (processingNoteIds.has(id)) return false;
		const targetNote = notes.find((n) => n.id === id);
		if (!targetNote) return false;

		setProcessingNoteIds((prev) => new Set(prev).add(id));

		updateLocalNoteState(
			(prev) =>
				prev
					.map((n) => (n.id === id ? { ...n, sort_order: newOrder } : n))
					.sort(sortNotesConsistent),
			targetNote.scope,
		);
		setFavoriteNotes((prev) =>
			prev
				.map((n) => (n.id === id ? { ...n, sort_order: newOrder } : n))
				.sort(sortNotesConsistent),
		);

		try {
			if (authStatus.mode === "guest") {
				const guestClient = client as unknown as typeof localClient;
				if (typeof guestClient.from === "function") {
					try {
						await (guestClient
							.from("sitecue_notes")
							.update({ sort_order: newOrder })
							.eq("id", id) as unknown as Promise<unknown>);
					} catch (e) {
						console.warn("localClient updateNoteOrder fell back", e);
					}
				}
			} else {
				await updateNoteEntity(client as unknown as typeof supabase, id, {
					sort_order: newOrder,
				});
			}
			return true;
		} catch (error) {
			console.error("Failed to update note order", error);
			toast.error("Failed to reorder notes");
			if (targetNote.scope === "inbox") {
				fetchInboxNotes();
			} else {
				fetchPageNotes();
			}
			fetchFavoriteNotes();
			return false;
		} finally {
			setProcessingNoteIds((prev) => {
				const next = new Set(prev);
				next.delete(id);
				return next;
			});
		}
	};

	const toggleNoteExpansion = async (id: string, currentValue: boolean) => {
		const nextValue = !currentValue;
		const targetNote = notes.find((n) => n.id === id);
		if (!targetNote) return false;

		updateLocalNoteState(
			(prev) =>
				prev.map((n) => (n.id === id ? { ...n, is_expanded: nextValue } : n)),
			targetNote.scope,
		);
		setFavoriteNotes((prev) =>
			prev.map((n) => (n.id === id ? { ...n, is_expanded: nextValue } : n)),
		);

		try {
			if (authStatus.mode === "guest") {
				const guestClient = client as unknown as typeof localClient;
				if (typeof guestClient.from === "function") {
					try {
						await (guestClient
							.from("sitecue_notes")
							.update({ is_expanded: nextValue })
							.eq("id", id) as unknown as Promise<unknown>);
					} catch (e) {
						console.warn("localClient toggleNoteExpansion fell back", e);
					}
				}
			} else {
				await updateNoteEntity(client as unknown as typeof supabase, id, {
					is_expanded: nextValue,
				});
			}
			return true;
		} catch (error) {
			console.error("Failed to toggle expansion", error);
			updateLocalNoteState(
				(prev) =>
					prev.map((n) =>
						n.id === id ? { ...n, is_expanded: currentValue } : n,
					),
				targetNote.scope,
			);
			setFavoriteNotes((prev) =>
				prev.map((n) =>
					n.id === id ? { ...n, is_expanded: currentValue } : n,
				),
			);
			toast.error("Failed to update note");
			return false;
		}
	};

	return {
		notes,
		loading,
		isInboxLoading,
		fetchNotes: fetchPageNotes,
		fetchInboxNotes,
		addNote,
		updateNote,
		deleteNote,
		toggleResolved,
		toggleFavorite,
		togglePinned,
		updateNoteOrder,
		toggleNoteExpansion,
	};
}
