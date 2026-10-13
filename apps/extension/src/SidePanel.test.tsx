import type { Session } from "@supabase/supabase-js";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SidePanel from "./SidePanel";

// Mock hooks
vi.mock("./supabaseClient", () => ({
	supabase: {
		from: vi.fn(() => ({
			select: vi.fn().mockReturnThis(),
			or: vi.fn().mockReturnThis(),
			order: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			single: vi.fn().mockReturnThis(),
			maybeSingle: vi.fn().mockReturnThis(),
			insert: vi.fn().mockReturnThis(),
			update: vi.fn().mockReturnThis(),
			delete: vi.fn().mockReturnThis(),
		})),
	},
}));

vi.mock("./hooks/useAuth", () => ({
	useAuth: vi.fn(() => ({
		session: { user: { id: "user-1" } },
		authLoading: false,
		authError: null,
		sessionLoading: false,
		handleLogout: vi.fn(),
		handleSocialLogin: vi.fn(),
		authStatus: {
			mode: "authenticated",
			session: { user: { id: "user-1" } } as unknown as Session,
			userId: "user-1",
		},
		handleGuestLogin: vi.fn(),
		handleGuestLogout: vi.fn(),
	})),
}));

vi.mock("./hooks/useCurrentTab", () => ({
	useCurrentTab: () => ({
		currentFullUrl: "https://example.com/page",
		url: "https://example.com/page",
		title: "Example Page",
	}),
}));

vi.mock("./hooks/useUserStats", () => ({
	useUserStats: () => ({
		userPlan: "free",
		totalNoteCount: 10,
		setTotalNoteCount: vi.fn(),
		userStatsLoading: false,
	}),
}));

const mockNotes = [
	{
		id: "1",
		content: "Exact Note",
		note_type: "info",
		scope: "exact",
		url_pattern: "example.com/page",
		is_resolved: false,
		is_pinned: false,
		is_favorite: false,
		sort_order: 1,
		created_at: new Date().toISOString(),
	},
	{
		id: "2",
		content: "Domain Note",
		note_type: "alert",
		scope: "domain",
		url_pattern: "example.com",
		is_resolved: false,
		is_pinned: false,
		is_favorite: false,
		sort_order: 2,
		created_at: new Date().toISOString(),
	},
	{
		id: "3",
		content: "Inbox Note",
		note_type: "info",
		scope: "inbox",
		url_pattern: "inbox",
		is_resolved: false,
		is_pinned: false,
		is_favorite: false,
		sort_order: 3,
		created_at: new Date().toISOString(),
	},
	{
		id: "4",
		content: "Other Page Note",
		note_type: "info",
		scope: "exact",
		url_pattern: "other.com/page",
		is_resolved: false,
		is_pinned: false,
		is_favorite: false,
		sort_order: 4,
		created_at: new Date().toISOString(),
	},
	{
		id: "5",
		content: "Favorite Note (Other Scope)",
		note_type: "idea",
		scope: "exact",
		url_pattern: "other.com/page",
		is_resolved: false,
		is_pinned: false,
		is_favorite: true, // お気に入り
		sort_order: 5,
		created_at: new Date().toISOString(),
	},
];

vi.mock("./hooks/useNotes", () => ({
	useNotes: vi.fn(() => ({
		notes: mockNotes,
		loading: false,
		isInboxLoading: false,
		addNote: vi.fn(),
		updateNote: vi.fn(),
		deleteNote: vi.fn(),
		toggleResolved: vi.fn(),
		toggleFavorite: vi.fn(),
		togglePinned: vi.fn(),
		updateNoteOrder: vi.fn(),
		toggleNoteExpansion: vi.fn(),
	})),
}));

describe("SidePanel Component", () => {
	it("グリッドレイアウトが正しく適用されていること", () => {
		const { container } = render(<SidePanel />);
		const mainDiv = container.querySelector(".grid");
		expect(mainDiv).toHaveClass("grid-rows-[auto_auto_auto_auto_1fr]");
	});

	it("フィルターの切り替えで表示されるノートが連動して変わること", async () => {
		render(<SidePanel />);

		// デフォルトは Exact スコープ
		expect(screen.getByText("Exact Note")).toBeInTheDocument();

		// Info フィルターをクリック
		const infoFilterButton = screen.getByTitle("Filter by Info");
		fireEvent.click(infoFilterButton);

		// Exact Note (info) は表示され、Favorite Note (idea) は消えるはず
		expect(screen.getByText("Exact Note")).toBeInTheDocument();
		expect(
			screen.queryByText("Favorite Note (Other Scope)"),
		).not.toBeInTheDocument();
	});

	it("検索入力で表示されるノートが連動して変わること", async () => {
		render(<SidePanel />);

		const searchInput = screen.getByPlaceholderText("Search...");
		fireEvent.change(searchInput, { target: { value: "Exact" } });

		// Exact Note だけが表示されるはず
		expect(screen.getByText("Exact Note")).toBeInTheDocument();
		expect(screen.queryByText("Domain Note")).not.toBeInTheDocument();
	});

	it("タブ（viewScope）の切り替えで表示されるノートがフィルタリングされ、他ドメインのノートが隔離されること", async () => {
		vi.useFakeTimers();
		try {
			render(<SidePanel />);

			// 1. 最初は Page (exact) タブが選択されているはず
			expect(screen.getByText("Exact Note")).toBeInTheDocument();
			expect(screen.queryByText("Domain Note")).not.toBeInTheDocument();
			expect(screen.queryByText("Inbox Note")).not.toBeInTheDocument();

			// 他ドメインの通常ノート (Note 4) は表示されないこと
			expect(screen.queryByText("Other Page Note")).not.toBeInTheDocument();

			// お気に入りであれば、他ドメインのノート (Note 5) も表示される
			const favoritesButton = screen.getByText(/FAVORITES/);
			fireEvent.click(favoritesButton);
			expect(
				screen.getByText("Favorite Note (Other Scope)"),
			).toBeInTheDocument();

			// 2. Domain タブに切り替え
			const domainTab = screen.getByRole("button", { name: /Domain/ });
			fireEvent.click(domainTab);

			act(() => {
				vi.advanceTimersByTime(600);
			});

			expect(screen.queryByText("Exact Note")).not.toBeInTheDocument();
			expect(screen.getByText("Domain Note")).toBeInTheDocument();
			expect(screen.queryByText("Inbox Note")).not.toBeInTheDocument();
			// お気に入りであれば、他ドメイン・他スコープであっても表示される（グローバルお気に入り）
			expect(
				screen.getByText("Favorite Note (Other Scope)"),
			).toBeInTheDocument();

			// 3. Inbox タブに切り替え
			const inboxTab = screen.getByRole("button", { name: /Inbox/ });
			fireEvent.click(inboxTab);

			act(() => {
				vi.advanceTimersByTime(600);
			});

			expect(screen.queryByText("Exact Note")).not.toBeInTheDocument();
			expect(screen.queryByText("Domain Note")).not.toBeInTheDocument();
			expect(screen.getByText("Inbox Note")).toBeInTheDocument();
			// 全スコープのお気に入りノートは Inbox タブでも最上部 FAVORITES 内で展開可能
			expect(
				screen.getByText("Favorite Note (Other Scope)"),
			).toBeInTheDocument();
		} finally {
			vi.useRealTimers();
		}
	});

	it("他ドメインのお気に入りノートを解除したとき、即座に画面から消えること", async () => {
		vi.useFakeTimers();
		try {
			// すでに vi.mock でモック化されている useNotes を取得
			const { useNotes } = await import("./hooks/useNotes");
			const mockUseNotes = vi.mocked(useNotes);

			const { rerender } = render(<SidePanel />);

			// お気に入りセクションを開く
			const favoritesButton = screen.getByText(/FAVORITES/);
			fireEvent.click(favoritesButton);
			expect(
				screen.getByText("Favorite Note (Other Scope)"),
			).toBeInTheDocument();

			// モックの返り値を「お気に入り解除後」の状態に更新
			const updatedNotes = mockNotes.map((n) =>
				n.id === "5" ? { ...n, is_favorite: false } : n,
			);

			mockUseNotes.mockReturnValue({
				notes: updatedNotes,
				loading: false,
				isInboxLoading: false,
				addNote: vi.fn(),
				updateNote: vi.fn(),
				deleteNote: vi.fn(),
				toggleResolved: vi.fn(),
				toggleFavorite: vi.fn(),
				togglePinned: vi.fn(),
				updateNoteOrder: vi.fn(),
				toggleNoteExpansion: vi.fn(),
			} as unknown as ReturnType<typeof useNotes>);

			rerender(<SidePanel />);

			act(() => {
				vi.advanceTimersByTime(600);
			});

			// お気に入りを解除した他ドメインのノートは、現在の Page タブから消えるはず
			expect(
				screen.queryByText("Favorite Note (Other Scope)"),
			).not.toBeInTheDocument();
		} finally {
			vi.useRealTimers();
		}
	});

	it("コピーボタンをクリックしてメニューからTextコピーができること", async () => {
		const writeTextMock = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText: writeTextMock },
			configurable: true,
		});

		render(<SidePanel />);

		const copyButton = screen.getByLabelText("Open copy options menu");
		fireEvent.click(copyButton);

		const copyTextButton = screen.getByText("Copy as Text");
		fireEvent.click(copyTextButton);

		// デフォルトで表示されている Exact Note のコンテンツがコピーされること
		expect(writeTextMock).toHaveBeenCalledWith("Exact Note");
	});

	it("ダイアリーアイコンクリックによるドロワー展開、およびURL変更時もドロワーが維持されるライフサイクルの検証", async () => {
		const { rerender } = render(<SidePanel />);

		// 1. 最初はドロワーが非表示（translate-x-full）
		const drawer = screen.getByTitle("Close diary").closest("div.fixed");
		expect(drawer).toHaveClass("translate-x-full");

		// 2. ダイアリーアイコン (Open diary) をクリックしてドロワーを開く
		const diaryIcon = screen.getByTitle("Open diary");
		fireEvent.click(diaryIcon);

		// translate-x-0 になること
		expect(drawer).toHaveClass("translate-x-0");

		// 3. rerender してURL変更等のライフサイクル再評価時も isDiaryOpen が維持されることを検証
		rerender(<SidePanel />);
		expect(drawer).toHaveClass("translate-x-0");
	});

	it("ドロワー内のBasecampリンクが今月のアーカイブURLになっていることの検証", async () => {
		render(<SidePanel />);

		// ドロワーを展開
		const diaryBtn = screen.getByTitle("Open diary");
		fireEvent.click(diaryBtn);

		// Basecampリンクのhref属性が、選択日(今日)の年・月に紐づくアーカイブURLになっているか検証
		const now = new Date();
		const expectedYear = now.getFullYear().toString();
		const expectedMonth = String(now.getMonth() + 1).padStart(2, "0");

		const basecampLink = await screen.findByText("... Basecamp ↗");
		expect(basecampLink.closest("a")).toBeInTheDocument();
		expect(basecampLink.closest("a")?.getAttribute("href")).toBe(
			`https://app.sitecue.app/notes?view=diaries&year=${expectedYear}&month=${expectedMonth}`,
		);
	});

	it("閲覧表示をクリックすると編集モード（Textarea）が展開されること", async () => {
		render(<SidePanel />);

		// ドロワーを展開
		const diaryBtn = screen.getByTitle("Open diary");
		fireEvent.click(diaryBtn);

		// 閲覧表示エリアをクリックして編集モードへ突入
		const diaryContent = await screen.findByText(
			"No logs written for this day.",
		);
		fireEvent.mouseDown(diaryContent, { clientX: 0, clientY: 0 });
		fireEvent.mouseUp(diaryContent, { clientX: 0, clientY: 0 });

		// テキストエリアが出現することを確認
		const textarea = await screen.findByPlaceholderText(
			/Write down your thoughts/i,
		);
		expect(textarea).toBeInTheDocument();
	});
});

describe("SidePanel - Zen Notes Mode", () => {
	it("アクションバー左端の最大化ボタンをクリックすると上部シェルが非表示になり、縮小ボタンまたはEscapeで復帰すること", () => {
		render(<SidePanel />);

		// 初期状態: ヘッダーやフィルターバーの要素が存在する
		expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();

		const maximizeBtn = screen.getByTitle("Maximize notes view");
		expect(maximizeBtn).toBeInTheDocument();

		// 最大化を実行
		fireEvent.click(maximizeBtn);

		// 上部シェルを包括するラッパーに hidden クラスが付与されていること
		const searchInput = screen.getByPlaceholderText("Search...");
		const wrapper = searchInput.closest(".hidden");
		expect(wrapper).toHaveClass("hidden");

		// ボタンのタイトルが縮小モードに変わっていること
		const exitBtn = screen.getByTitle("Exit full view");
		expect(exitBtn).toBeInTheDocument();

		// Escapeキーを押下して復帰
		fireEvent.keyDown(window, { key: "Escape" });

		expect(screen.getByTitle("Maximize notes view")).toBeInTheDocument();
		expect(wrapper).not.toHaveClass("hidden");
	});

	it("最大化中に新規ノートモーダルが開いている場合、Escapeキーはモーダルを優先して閉じ、最大化は維持されること", () => {
		render(<SidePanel />);

		// 1. 最大化
		fireEvent.click(screen.getByTitle("Maximize notes view"));
		expect(screen.getByTitle("Exit full view")).toBeInTheDocument();

		// 2. 「＋」ボタンを押して新規ノートモーダルを開く
		fireEvent.click(screen.getByTitle("Create new note"));
		expect(screen.getByLabelText("Close input overlay")).toBeInTheDocument();

		// 3. Escapeキーを押下 -> モーダルが閉じる
		fireEvent.keyDown(window, { key: "Escape" });
		expect(
			screen.queryByLabelText("Close input overlay"),
		).not.toBeInTheDocument();

		// 最大化は維持されていること（タイトルが Exit full view のまま）
		expect(screen.getByTitle("Exit full view")).toBeInTheDocument();

		// 4. もう一度 Escapeキーを押下 -> 最大化が解除される
		fireEvent.keyDown(window, { key: "Escape" });
		expect(screen.getByTitle("Maximize notes view")).toBeInTheDocument();
	});

	it("最大化中にノート一覧内でインライン編集中（textareaが存在）の場合、Escapeキーを押下しても最大化は維持されること", () => {
		render(<SidePanel />);

		// 1. 最大化
		fireEvent.click(screen.getByTitle("Maximize notes view"));
		expect(screen.getByTitle("Exit full view")).toBeInTheDocument();

		// 2. ノートの編集ボタン（Edit）をクリックして編集モードを起動
		const editButtons = screen.getAllByTitle("Edit");
		fireEvent.click(editButtons[0]);

		// 編集用textareaが出現していることを確認
		const textareas = screen.getAllByRole("textbox");
		expect(textareas.length).toBeGreaterThan(0);

		// 3. Escapeキーを押下 -> 最大化は解除されず Exit full view のままであること
		fireEvent.keyDown(window, { key: "Escape" });
		expect(screen.getByTitle("Exit full view")).toBeInTheDocument();
	});
});

describe("SidePanel - Inbox Skeleton Minimum Hold Test", () => {
	it("Inbox初回選択時にスケルトンが最低300ms表示され、タイマー経過後にノートが表示されること", async () => {
		vi.useFakeTimers();
		try {
			render(<SidePanel />);

			// 初期は Exact (Page)
			expect(screen.getByText("Exact Note")).toBeInTheDocument();

			// Inbox タブをクリック
			const inboxTab = screen.getByRole("button", { name: /Inbox/ });
			fireEvent.click(inboxTab);

			// 0ms時点: スケルトンが表示されていること（NoteSkeletonの存在検証）
			const skeletons = screen.getAllByTestId("note-skeleton");
			expect(skeletons.length).toBeGreaterThan(0);
			expect(screen.queryByText("Inbox Note")).not.toBeInTheDocument();

			// 200ms経過時点: まだ最低300msホールド中のためスケルトンが維持されていること
			act(() => {
				vi.advanceTimersByTime(200);
			});
			expect(screen.getAllByTestId("note-skeleton").length).toBeGreaterThan(0);
			expect(screen.queryByText("Inbox Note")).not.toBeInTheDocument();

			// 300ms経過時点: ホールドタイマーが完了し、Inbox Note が表示されること
			act(() => {
				vi.advanceTimersByTime(100);
			});
			expect(screen.queryByTestId("note-skeleton")).not.toBeInTheDocument();
			expect(screen.getByText("Inbox Note")).toBeInTheDocument();

			// 2回目以降（Warm State）: 他タブから再度Inboxへ切り替えた際は0msで即時表示されること
			const pageTab = screen.getByRole("button", { name: /Page/ });
			fireEvent.click(pageTab);
			act(() => {
				vi.advanceTimersByTime(600);
			});

			fireEvent.click(inboxTab);
			// 0ms でスケルトンが出ず即時表示されること
			expect(screen.queryByTestId("note-skeleton")).not.toBeInTheDocument();
			expect(screen.getByText("Inbox Note")).toBeInTheDocument();
		} finally {
			vi.useRealTimers();
		}
	});
});
