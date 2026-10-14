import { describe, expect, it, vi } from "vitest";
import {
	deleteNoteEntity,
	fetchExtensionFavoriteMetadatas,
	fetchExtensionInboxMetadatas,
	fetchExtensionNoteMetadatas,
	fetchNoteContents,
	fetchNoteMetadatas,
	getMatchingNoteCount,
	searchNotesAndDrafts,
} from "./notes";

// biome-ignore lint/suspicious/noExplicitAny: モック構築用
type AnyClient = any;

describe("Shared DAL: notes", () => {
	it("fetchNoteMetadatasが正しいクエリチェーンを構築してデータを返すこと", async () => {
		const mockData = [{ id: "note-1", url_pattern: "example.com" }];

		// Supabaseクライアントのメソッドチェーンを正確にモック化
		const mockOrder3 = vi
			.fn()
			.mockResolvedValue({ data: mockData, error: null });
		const mockOrder2 = vi.fn().mockReturnValue({ order: mockOrder3 });
		const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
		const mockEq = vi.fn().mockReturnValue({ order: mockOrder1 });
		const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
		const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
		const supabase: AnyClient = { from: mockFrom };

		const res = await fetchNoteMetadatas(supabase, "user-123");

		expect(mockFrom).toHaveBeenCalledWith("sitecue_notes");
		expect(mockSelect).toHaveBeenCalled();
		expect(mockEq).toHaveBeenCalledWith("user_id", "user-123");
		expect(res).toEqual(mockData);
	});

	it("fetchNoteContentsが空配列の時はAPIを叩かずに早期リターンすること", async () => {
		const mockIn = vi.fn();
		const mockSelect = vi.fn().mockReturnValue({ in: mockIn });
		const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
		const supabase: AnyClient = { from: mockFrom };

		const res = await fetchNoteContents(supabase, []);

		expect(res).toEqual([]);
		expect(mockFrom).not.toHaveBeenCalled();
	});

	it("deleteNoteEntityが正しいクエリチェーンを構築してIDを返すこと", async () => {
		const mockEq = vi.fn().mockResolvedValue({ error: null });
		const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
		const mockFrom = vi.fn().mockReturnValue({ delete: mockDelete });
		const supabase: AnyClient = { from: mockFrom };

		const res = await deleteNoteEntity(supabase, "note-123");

		expect(mockFrom).toHaveBeenCalledWith("sitecue_notes");
		expect(mockDelete).toHaveBeenCalled();
		expect(mockEq).toHaveBeenCalledWith("id", "note-123");
		expect(res).toBe("note-123");
	});

	it("getMatchingNoteCountが新設RPC get_matching_active_note_count を正しいパラメータで呼び出し件数を返すこと", async () => {
		const mockRpc = vi.fn().mockResolvedValue({ data: 3, error: null });
		const supabase: AnyClient = { rpc: mockRpc };

		const count = await getMatchingNoteCount(
			supabase,
			"example.com",
			"https://example.com/page",
		);

		expect(mockRpc).toHaveBeenCalledWith("get_matching_active_note_count", {
			p_domain: "example.com",
			p_exact: "https://example.com/page",
		});
		expect(count).toBe(3);
	});

	it("getMatchingNoteCountでRPCがnullを返した場合に0を返すこと", async () => {
		const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
		const supabase: AnyClient = { rpc: mockRpc };

		const count = await getMatchingNoteCount(
			supabase,
			"example.com",
			"https://example.com/page",
		);

		expect(count).toBe(0);
	});
});

describe("Shared DAL: Extension Notes Isolation", () => {
	it("fetchExtensionNoteMetadatasのデフォルトでは Inbox スコープが含まれず、オプション指定時のみ含まれること", async () => {
		const mockOrder2 = vi.fn().mockResolvedValue({ data: [], error: null });
		const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
		const mockOr = vi.fn().mockReturnValue({ order: mockOrder1 });
		const mockSelect = vi.fn().mockReturnValue({ or: mockOr });
		const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
		const supabase: AnyClient = { from: mockFrom };

		// 1. デフォルト呼び出し
		await fetchExtensionNoteMetadatas(supabase, {
			domain: "example.com",
			exact: "https://example.com/page",
		});
		expect(mockOr).toHaveBeenCalledWith(
			expect.not.stringContaining("scope.eq.inbox"),
		);

		// 2. includeInbox: true 呼び出し
		await fetchExtensionNoteMetadatas(
			supabase,
			{ domain: "example.com", exact: "https://example.com/page" },
			{ includeInbox: true },
		);
		expect(mockOr).toHaveBeenCalledWith(
			expect.stringContaining("scope.eq.inbox"),
		);
	});

	it("fetchExtensionNoteMetadatasのクエリにお気に入り条件が含まれず、純粋に対象URLのみで構築されること", async () => {
		const mockOrder2 = vi.fn().mockResolvedValue({ data: [], error: null });
		const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
		const mockOr = vi.fn().mockReturnValue({ order: mockOrder1 });
		const mockSelect = vi.fn().mockReturnValue({ or: mockOr });
		const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
		const supabase: AnyClient = { from: mockFrom };

		await fetchExtensionNoteMetadatas(supabase, {
			domain: "example.com",
			exact: "https://example.com/page",
		});

		expect(mockOr).toHaveBeenCalledWith(
			expect.not.stringContaining("is_favorite.eq.true"),
		);
		expect(mockOr).toHaveBeenCalledWith(
			'and(url_pattern.eq."example.com",scope.eq.domain),and(url_pattern.eq."https://example.com/page",scope.eq.exact)',
		);
	});

	it("fetchExtensionFavoriteMetadatasがお気に入り条件（is_favorite=true）でクエリを構築すること", async () => {
		const mockOrder2 = vi.fn().mockResolvedValue({ data: [], error: null });
		const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
		const mockEq = vi.fn().mockReturnValue({ order: mockOrder1 });
		const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
		const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
		const supabase: AnyClient = { from: mockFrom };

		await fetchExtensionFavoriteMetadatas(supabase);

		expect(mockFrom).toHaveBeenCalledWith("sitecue_notes");
		expect(mockEq).toHaveBeenCalledWith("is_favorite", true);
	});

	it("fetchExtensionInboxMetadatasがscope=inboxで絞り込みクエリを構築すること", async () => {
		const mockOrder2 = vi.fn().mockResolvedValue({ data: [], error: null });
		const mockOrder1 = vi.fn().mockReturnValue({ order: mockOrder2 });
		const mockEq = vi.fn().mockReturnValue({ order: mockOrder1 });
		const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
		const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
		const supabase: AnyClient = { from: mockFrom };

		await fetchExtensionInboxMetadatas(supabase);

		expect(mockFrom).toHaveBeenCalledWith("sitecue_notes");
		expect(mockEq).toHaveBeenCalledWith("scope", "inbox");
	});
});

describe("Shared DAL: searchNotesAndDrafts", () => {
	it("qが指定された場合、RPC search_notes と search_drafts が並列実行されること", async () => {
		const mockNotes = [{ id: "1", content: "Test note" }];
		const mockRpc = vi.fn().mockImplementation((name) => ({
			order: vi.fn().mockReturnThis(),
			// biome-ignore lint/suspicious/noThenProperty: Supabase thenable mock
			then: vi.fn().mockImplementation((cb) =>
				cb({
					data: name === "search_notes" ? mockNotes : [],
					error: null,
				}),
			),
		}));
		const supabase: AnyClient = { rpc: mockRpc };

		const res = await searchNotesAndDrafts(supabase, { q: "Test" });

		expect(mockRpc).toHaveBeenCalledWith("search_notes", {
			search_query: "Test",
		});
		expect(mockRpc).toHaveBeenCalledWith("search_drafts", {
			search_query: "Test",
		});
		expect(res).toEqual({ notes: mockNotes, drafts: [] });
	});

	it("tagsのみが指定された場合、通常のテーブルクエリでcontainsフィルタが適用されること", async () => {
		const mockChain = {
			select: vi.fn().mockReturnThis(),
			contains: vi.fn().mockReturnThis(),
			order: vi.fn().mockReturnThis(),
			// biome-ignore lint/suspicious/noThenProperty: Supabase thenable mock
			then: vi.fn().mockImplementation((cb) => cb({ data: [], error: null })),
		};
		const mockFrom = vi.fn().mockReturnValue(mockChain);
		const supabase: AnyClient = { from: mockFrom };

		await searchNotesAndDrafts(supabase, { tags: "tag1" });

		expect(mockFrom).toHaveBeenCalledWith("sitecue_notes");
		expect(mockFrom).toHaveBeenCalledWith("sitecue_drafts");
		expect(mockChain.contains).toHaveBeenCalledWith("tags", ["tag1"]);
	});
});
