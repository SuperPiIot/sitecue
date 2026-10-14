"use client";

import {
	type CreateNoteInput,
	createNoteEntity,
	deleteNoteEntity,
	deleteNotesEntity,
	fetchNoteContents,
	fetchNoteMetadatas,
	type Note,
	type NoteType,
	searchNotesAndDrafts,
	updateNoteEntity,
	type ViewScope,
} from "@sitecue/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Draft } from "@/app/(dashboard)/notes/types";
import { DASHBOARD_QUERY_KEY } from "@/hooks/useDashboardQuery";
import { broadcastCacheSync } from "@/hooks/useTabSync";
import { createClient } from "@/utils/supabase/client";

export const NOTES_QUERY_KEY = ["notes"];

export function useFetchNotes() {
	const queryClient = useQueryClient();

	return useQuery({
		queryKey: NOTES_QUERY_KEY,
		staleTime: 5 * 60 * 1000, // 5分間はバックグラウンドフェッチによる上書きを防ぐ
		queryFn: async (): Promise<Note[]> => {
			const supabase = createClient();
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error("User not authenticated");

			const metadatas = await fetchNoteMetadatas(supabase, user.id);

			// 💡 既存の TanStack Query キャッシュから保存済みの本文 (content) を保護・マージする
			const existingCache = queryClient.getQueryData<Note[]>(NOTES_QUERY_KEY);
			const existingContentMap = new Map(
				existingCache
					?.filter((n) => n.content !== undefined)
					.map((n) => [n.id, n.content]),
			);

			return metadatas.map((meta) => {
				const existingContent = existingContentMap.get(meta.id);
				return {
					...meta,
					...(existingContent !== undefined
						? { content: existingContent }
						: {}),
				};
			}) as unknown as Note[];
		},
	});
}

export function useCreateNote() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (input: CreateNoteInput) => {
			const supabase = createClient();
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error("User not authenticated");

			return await createNoteEntity(supabase, user.id, input);
		},
		onSuccess: (newNote) => {
			const sortNotes = (notes: Note[]) => {
				return [...notes].sort((a, b) => {
					if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
					if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
					return (
						new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
					);
				});
			};

			// 1. 手元キャッシュへ 0ms 即時追加
			queryClient.setQueriesData<Note[] | { notes: Note[]; drafts: unknown[] }>(
				{ queryKey: NOTES_QUERY_KEY },
				(old) => {
					if (!old) return [newNote as Note];
					if (Array.isArray(old)) {
						const exists = old.some((n) => n.id === newNote.id);
						const updated = exists
							? old.map((n) => (n.id === newNote.id ? (newNote as Note) : n))
							: [newNote as Note, ...old];
						return sortNotes(updated);
					}
					if ("notes" in old) {
						const exists = old.notes.some((n) => n.id === newNote.id);
						const updated = exists
							? old.notes.map((n) =>
									n.id === newNote.id ? (newNote as Note) : n,
								)
							: [newNote as Note, ...old.notes];
						return {
							...old,
							notes: sortNotes(updated),
						};
					}
					return old;
				},
			);

			// 2. 関連キャッシュを一括バックグラウンド再検証
			queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY });
			queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
			broadcastCacheSync(NOTES_QUERY_KEY);
			broadcastCacheSync(DASHBOARD_QUERY_KEY);
		},
	});
}

export function useUpdateNote() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			id,
			updates,
		}: {
			id: string;
			updates: {
				content?: string;
				note_type?: NoteType;
				scope?: ViewScope;
				currentUrl?: string;
				is_resolved?: boolean;
				is_pinned?: boolean;
				is_favorite?: boolean;
				is_expanded?: boolean;
				sort_order?: number;
			};
		}) => {
			const supabase = createClient();
			return await updateNoteEntity(supabase, id, updates);
		},
		onSuccess: (updatedNote) => {
			// 💡 1. サーバーおよびデータベースと100%一貫した並び順を保証するソート関数を定義
			const sortNotes = (notes: Note[]) => {
				return [...notes].sort((a, b) => {
					// 規約1: is_pinned 降順 (ピン留めが上)
					if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
					// 規約2: sort_order 昇順 (数値が小さい順)
					if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
					// 規約3: created_at 降順 (作成日時が新しい順)
					return (
						new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
					);
				});
			};

			// プレフィックス一致でキャッシュを一括分配・更新する規約を順守
			queryClient.setQueriesData<Note[] | { notes: Note[]; drafts: unknown[] }>(
				{ queryKey: NOTES_QUERY_KEY },
				(old) => {
					if (!old) return old;
					if (Array.isArray(old)) {
						const updated = old.map((note) =>
							note.id === updatedNote.id ? updatedNote : note,
						);
						// 💡 2. 単純なmapによる数値置換だけでなく、配列全体の並び順をソートしてキャッシュを要塞化する
						return sortNotes(updated);
					}
					if ("notes" in old) {
						const updated = old.notes.map((note) =>
							note.id === updatedNote.id ? updatedNote : note,
						);
						return {
							...old,
							// 💡 3. 検索結果オブジェクト内の配列に対しても同様にソートを適用して透過的に分配する
							notes: sortNotes(updated),
						};
					}
					return old;
				},
			);
			queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY });
			queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
			broadcastCacheSync(NOTES_QUERY_KEY);
			broadcastCacheSync(DASHBOARD_QUERY_KEY);
		},
	});
}

export function useDeleteNote() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (id: string) => {
			const supabase = createClient();
			return await deleteNoteEntity(supabase, id);
		},
		onSuccess: (deletedId) => {
			queryClient.setQueriesData<Note[] | { notes: Note[]; drafts: unknown[] }>(
				{ queryKey: NOTES_QUERY_KEY },
				(old) => {
					if (!old) return old;
					if (Array.isArray(old)) {
						return old.filter((note) => note.id !== deletedId);
					}
					if ("notes" in old) {
						return {
							...old,
							notes: old.notes.filter((note) => note.id !== deletedId),
						};
					}
					return old;
				},
			);

			queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY });
			queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
			broadcastCacheSync(NOTES_QUERY_KEY);
			broadcastCacheSync(DASHBOARD_QUERY_KEY);
		},
	});
}

/**
 * Lazily fetch content for multiple notes and update the query cache.
 */
export function useFetchNoteContents() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (ids: string[]) => {
			const supabase = createClient();
			return await fetchNoteContents(supabase, ids);
		},
		onSuccess: (contents) => {
			if (contents.length === 0) return;

			const contentMap = new Map(contents.map((n) => [n.id, n.content]));

			queryClient.setQueriesData<Note[] | { notes: Note[]; drafts: Draft[] }>(
				{ queryKey: NOTES_QUERY_KEY },
				(old) => {
					if (!old) return old;

					const updateNote = (n: Note): Note =>
						contentMap.has(n.id)
							? ({ ...n, content: contentMap.get(n.id) } as Note)
							: n;

					if (Array.isArray(old)) {
						return old.map(updateNote); // 通常リスト
					}
					if ("notes" in old) {
						return { ...old, notes: old.notes.map(updateNote) }; // 検索結果オブジェクト
					}
					return old;
				},
			);
		},
	});
}

export function useUpsertNotes() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (notes: Partial<Note>[]) => {
			if (notes.length === 0) return [];
			const supabase = createClient();
			const { data, error } = await supabase
				.from("sitecue_notes")
				.upsert(notes)
				.select();

			if (error) throw error;
			return data as Note[];
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY });
			queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
			broadcastCacheSync(NOTES_QUERY_KEY);
			broadcastCacheSync(DASHBOARD_QUERY_KEY);
		},
	});
}

export function useDeleteNotes() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (ids: string[]) => {
			const supabase = createClient();
			return await deleteNotesEntity(supabase, ids);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: NOTES_QUERY_KEY });
			queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
			broadcastCacheSync(NOTES_QUERY_KEY);
			broadcastCacheSync(DASHBOARD_QUERY_KEY);
		},
	});
}

export function useSearchNotes(
	q?: string,
	tags?: string,
	options: { enabled?: boolean } = {},
) {
	return useQuery({
		queryKey: [...NOTES_QUERY_KEY, "search", q, tags],
		queryFn: async () => {
			if (!q && !tags) return { notes: [], drafts: [] };
			const supabase = createClient();
			return await searchNotesAndDrafts(supabase, { q, tags });
		},
		staleTime: 5 * 60 * 1000,
		...options,
	});
}
