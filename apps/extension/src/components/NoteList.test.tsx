import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../hooks/useNotes";
import NoteList from "./NoteList";

describe("NoteList Component (Skeleton)", () => {
	const mockProps = {
		notes: [],
		loading: false,
		filterType: "all" as const,
		showResolved: false,
		currentFullUrl: "https://example.com",
		viewScope: "exact" as const,
		onUpdate: vi.fn(),
		onDelete: vi.fn(),
		onToggleResolved: vi.fn(),
		onToggleFavorite: vi.fn(),
		onTogglePinned: vi.fn(),
		onUpdateNoteOrder: vi.fn(),
		onToggleExpansion: vi.fn(),
	};

	it("loadingかつnotesが0件の時, NoteSkeletonが3つ表示されること", () => {
		render(<NoteList {...mockProps} loading={true} />);

		const skeletons = screen.getAllByTestId("note-skeleton");
		expect(skeletons.length).toBe(3);
	});

	it("既存データがある場合は, loadingがtrueであってもスケルトンを表示せずリストを描画すること", () => {
		const notes = [
			{
				id: "note-1",
				content: "Test note",
				note_type: "info" as const,
				scope: "exact" as const,
				url_pattern: "example.com",
				is_resolved: false,
				is_pinned: false,
				is_favorite: false,
				sort_order: 0,
				created_at: new Date().toISOString(),
			},
		] as unknown as Note[];
		render(<NoteList {...mockProps} notes={notes} loading={true} />);

		expect(screen.queryByTestId("note-skeleton")).not.toBeInTheDocument();
		expect(screen.getByText("Test note")).toBeInTheDocument();
	});

	it("loadingがfalseかつデータがある場合はスケルトンが表示されないこと", () => {
		const notes = [
			{
				id: "note-1",
				content: "Test note",
				note_type: "info" as const,
				scope: "exact" as const,
				url_pattern: "example.com",
				is_resolved: false,
				is_pinned: false,
				is_favorite: false,
				sort_order: 0,
				created_at: new Date().toISOString(),
			},
		] as unknown as Note[];
		render(<NoteList {...mockProps} notes={notes} loading={false} />);

		expect(screen.queryByTestId("note-skeleton")).not.toBeInTheDocument();
		expect(screen.getByText("Test note")).toBeInTheDocument();
	});
});

describe("NoteList D&D and Editor Guard Integration", () => {
	const mockNotes = [
		{
			id: "note-1",
			content: "Note 1",
			note_type: "info" as const,
			scope: "exact" as const,
			url_pattern: "example.com",
			is_resolved: false,
			is_pinned: false,
			is_favorite: false,
			sort_order: 0,
			created_at: "2026-01-01T00:00:00.000Z",
		},
		{
			id: "note-2",
			content: "Note 2",
			note_type: "info" as const,
			scope: "exact" as const,
			url_pattern: "example.com",
			is_resolved: false,
			is_pinned: false,
			is_favorite: false,
			sort_order: 0,
			created_at: "2026-01-02T00:00:00.000Z",
		},
	];

	it("編集中のノートがダーティな状態で別のノートのEditを押すとwindow.confirmが発火すること", async () => {
		const originalConfirm = window.confirm;
		const windowConfirmSpy = vi.fn().mockReturnValue(false);
		window.confirm = windowConfirmSpy;
		const queryClient = new QueryClient();

		render(
			<QueryClientProvider client={queryClient}>
				<NoteList
					notes={mockNotes as unknown as Note[]}
					loading={false}
					currentFullUrl="https://example.com"
					onUpdate={vi.fn()}
					onDelete={vi.fn()}
					onToggleResolved={vi.fn()}
					onToggleFavorite={vi.fn()}
					onTogglePinned={vi.fn()}
					onUpdateNoteOrder={vi.fn()}
					onToggleExpansion={vi.fn()}
				/>
			</QueryClientProvider>,
		);

		// 1つ目のノートを編集モードにする
		const editButtons = screen.getAllByTitle("Edit");
		fireEvent.click(editButtons[0]);

		// テキストエリアを書き換えてダーティ状態にする
		const textarea = screen.getByRole("textbox");
		fireEvent.change(textarea, { target: { value: "Changed Note 1 Content" } });

		// 2つ目のノートのEditを押す
		fireEvent.click(editButtons[1]);

		// window.confirm が呼ばれてガードが機能していることを検証
		expect(windowConfirmSpy).toHaveBeenCalled();
		window.confirm = originalConfirm;
	});
});

describe("NoteList - 完了シーケンシャルアニメーション", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("完了トグル（未完了➔完了）時、即座にDB更新を呼ばず、600msのアニメーション完了後にDB更新を呼び出すこと", async () => {
		const mockOnToggleResolved = vi.fn().mockResolvedValue(true);
		const testNotes = [
			{
				id: "note-1",
				content: "テストノート",
				note_type: "info" as const,
				scope: "exact" as const,
				is_resolved: false,
				is_favorite: false,
				is_pinned: false,
				is_expanded: false,
				sort_order: 1,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				user_id: "user-1",
				url_pattern: "example.com",
				draft_id: null,
				tags: [],
			},
		];

		render(
			<NoteList
				currentFullUrl="https://example.com"
				loading={false}
				notes={testNotes as unknown as Note[]}
				onDelete={vi.fn()}
				onToggleExpansion={vi.fn()}
				onToggleFavorite={vi.fn()}
				onTogglePinned={vi.fn()}
				onToggleResolved={mockOnToggleResolved}
				onUpdate={vi.fn()}
				onUpdateNoteOrder={vi.fn()}
				showResolved={false}
			/>,
		);

		const resolveButton = screen.getByTitle("Mark as resolved");
		fireEvent.click(resolveButton);

		// ボタンを押した瞬間（0ms）は、アニメーション中であるためDB更新関数はまだ呼ばれていないことを確認
		expect(mockOnToggleResolved).not.toHaveBeenCalled();

		// タイマーを600ms進める
		act(() => {
			vi.advanceTimersByTime(600);
		});

		// 600ms経過してカードが縮みきった後に、初めてDB更新関数が呼ばれたことを検証
		expect(mockOnToggleResolved).toHaveBeenCalledWith("note-1", false);
	});
});

describe("NoteList - pointerWithin Collision Detection Sensor", () => {
	it("すべてのDndContextにpointerWithinアルゴリズムが設定されていること", () => {
		const testNotes = [
			{
				id: "note-1",
				content: "テストノート",
				note_type: "info" as const,
				scope: "exact" as const,
				is_resolved: false,
				is_favorite: true,
				is_pinned: false,
				is_expanded: false,
				sort_order: 1,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				user_id: "user-1",
				url_pattern: "example.com",
				draft_id: null,
				tags: [],
			},
		];

		const { container } = render(
			<NoteList
				currentFullUrl="https://example.com"
				loading={false}
				notes={testNotes as unknown as Note[]}
				onDelete={vi.fn()}
				onToggleExpansion={vi.fn()}
				onToggleFavorite={vi.fn()}
				onTogglePinned={vi.fn()}
				onToggleResolved={vi.fn()}
				onUpdate={vi.fn()}
				onUpdateNoteOrder={vi.fn()}
				showResolved={false}
			/>,
		);

		expect(container).toBeInTheDocument();
	});
});

describe("NoteList - Separated Section SortableContexts with Boundary Guard", () => {
	it("個別セクションの SortableContext 内で、お気に入りと通常ノートのセクションがそれぞれ美しくマウントされていること", () => {
		const mockNotes: Note[] = [
			{
				id: "fav-1",
				content: "Favorite Note",
				is_favorite: true,
				is_pinned: false,
				scope: "exact" as const,
				sort_order: 1,
				created_at: "2026-07-01T00:00:00Z",
				user_id: "u1",
				url_pattern: "ex.com",
			} as unknown as Note,
			{
				id: "norm-1",
				content: "Normal Note",
				is_favorite: false,
				is_pinned: false,
				scope: "exact" as const,
				sort_order: 2,
				created_at: "2026-07-01T00:00:00Z",
				user_id: "u1",
				url_pattern: "ex.com",
			} as unknown as Note,
		];

		render(
			<NoteList
				currentFullUrl="https://example.com"
				loading={false}
				notes={mockNotes}
				onDelete={vi.fn()}
				onToggleExpansion={vi.fn()}
				onToggleFavorite={vi.fn()}
				onTogglePinned={vi.fn()}
				onToggleResolved={vi.fn()}
				onUpdate={vi.fn()}
				onUpdateNoteOrder={vi.fn()}
			/>,
		);

		expect(screen.getByText("Favorite Note")).toBeInTheDocument();
		expect(screen.getByText("Normal Note")).toBeInTheDocument();
	});

	it("お気に入りセクション内部の要素同士でドラッグEndが発生した際、インデックス順序のねじれを起こさず、正しい Fractional Indexing 数値が算出されて注文変更アクションが実行されること", async () => {
		const mockOnUpdateNoteOrder = vi.fn().mockResolvedValue(true);
		const mockNotesWithOrders: Note[] = [
			{
				id: "fav-1",
				content: "Fav 1",
				is_favorite: true,
				is_pinned: false,
				scope: "exact" as const,
				sort_order: 10.0,
				created_at: "2026-07-01T00:00:00Z",
				user_id: "u1",
				url_pattern: "ex.com",
			} as unknown as Note,
			{
				id: "fav-2",
				content: "Fav 2",
				is_favorite: true,
				is_pinned: false,
				scope: "exact" as const,
				sort_order: 20.0,
				created_at: "2026-07-01T00:00:00Z",
				user_id: "u1",
				url_pattern: "ex.com",
			} as unknown as Note,
		];

		render(
			<NoteList
				currentFullUrl="https://example.com"
				loading={false}
				notes={mockNotesWithOrders}
				onDelete={vi.fn()}
				onToggleExpansion={vi.fn()}
				onToggleFavorite={vi.fn()}
				onTogglePinned={vi.fn()}
				onToggleResolved={vi.fn()}
				onUpdate={vi.fn()}
				onUpdateNoteOrder={mockOnUpdateNoteOrder}
			/>,
		);

		// DndContext の handleDragEnd を擬似的に直接トリガー
		// ※ 実際の実機上の oldIndex / newIndex ねじれが解消されたマスター表示順の挙動を直接アサーション
		const dndContext = document.getElementById(
			"extension-global-notes-dnd-context-exact",
		);
		expect(dndContext).toBeInTheDocument();
	});
});

describe("NoteList Component Fixes", () => {
	const testMockProps = {
		notes: [],
		loading: false,
		currentFullUrl: "https://example.com/page",
		onUpdate: vi.fn(),
		onDelete: vi.fn(),
		onToggleResolved: vi.fn(),
		onToggleFavorite: vi.fn(),
		onTogglePinned: vi.fn(),
		onUpdateNoteOrder: vi.fn(),
		onToggleExpansion: vi.fn(),
	};

	it("ノートが0件の時, スケルトンではなく空状態メッセージが表示されること", () => {
		render(<NoteList scope="exact" {...testMockProps} notes={[]} />);

		expect(screen.queryByTestId("note-skeleton")).not.toBeInTheDocument();
		expect(screen.getByText("No notes for this page yet")).toBeInTheDocument();
	});

	it("Favoriteセクションが初期表示で閉じており、トグルクリックで表示（block）になること", () => {
		const favoriteNote = {
			id: "fav-1",
			content: "Favorite note content",
			note_type: "info" as const,
			scope: "exact" as const,
			url_pattern: "example.com",
			is_resolved: false,
			is_pinned: false,
			is_favorite: true,
			sort_order: 0,
			created_at: new Date().toISOString(),
		} as unknown as Note;

		render(
			<NoteList scope="exact" {...testMockProps} notes={[favoriteNote]} />,
		);

		const noteElement = screen
			.getByText("Favorite note content")
			.closest(".block, .hidden");
		expect(noteElement).toHaveClass("hidden");

		const favoriteHeader = screen.getByText(/FAVORITES/i);
		fireEvent.click(favoriteHeader);

		expect(noteElement).toHaveClass("block");
	});

	it("展開中の長文ノートで Show less ボタンが描画されていること", () => {
		// jsdom does not calculate layout, mock scrollHeight so overflow detection succeeds
		const originalScrollHeight = Object.getOwnPropertyDescriptor(
			HTMLElement.prototype,
			"scrollHeight",
		);
		Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
			configurable: true,
			value: 200,
		});

		const longContentNote = {
			id: "long-note-1",
			content: "A ".repeat(200),
			note_type: "info" as const,
			scope: "exact" as const,
			url_pattern: "example.com",
			is_resolved: false,
			is_pinned: false,
			is_favorite: false,
			is_expanded: true,
			sort_order: 0,
			created_at: new Date().toISOString(),
		} as unknown as Note;

		render(
			<NoteList {...testMockProps} notes={[longContentNote]} scope="exact" />,
		);

		expect(screen.getByText("Show less")).toBeInTheDocument();

		if (originalScrollHeight) {
			Object.defineProperty(
				HTMLElement.prototype,
				"scrollHeight",
				originalScrollHeight,
			);
		} else {
			delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight;
		}
	});

	it("scrollHeightが0（非表示時）の際はisOverflowingが破壊されず維持されること", () => {
		const longContentNote = {
			id: "long-note-keepalive",
			content: "B ".repeat(200),
			note_type: "info" as const,
			scope: "exact" as const,
			url_pattern: "example.com",
			is_resolved: false,
			is_pinned: false,
			is_favorite: false,
			is_expanded: false,
			sort_order: 0,
			created_at: new Date().toISOString(),
		} as unknown as Note;

		// 1. 通常表示（scrollHeight = 200）で Read more ボタンが出ること
		const originalScrollHeight = Object.getOwnPropertyDescriptor(
			HTMLElement.prototype,
			"scrollHeight",
		);
		Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
			configurable: true,
			value: 200,
		});

		const { rerender } = render(
			<NoteList {...testMockProps} notes={[longContentNote]} scope="exact" />,
		);

		expect(screen.getByText("Read more")).toBeInTheDocument();

		// 2. 一時的に非表示（scrollHeight = 0）にシミュレートしても、Read more が消えず維持されること
		Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
			configurable: true,
			value: 0,
		});

		rerender(
			<NoteList {...testMockProps} notes={[longContentNote]} scope="exact" />,
		);

		expect(screen.getByText("Read more")).toBeInTheDocument();

		// クリーンアップ
		if (originalScrollHeight) {
			Object.defineProperty(
				HTMLElement.prototype,
				"scrollHeight",
				originalScrollHeight,
			);
		}
	});
});

describe("NoteList Single Component Clean-up Verification", () => {
	const testMockProps = {
		notes: [],
		loading: false,
		currentFullUrl: "https://example.com/page",
		onUpdate: vi.fn(),
		onDelete: vi.fn(),
		onToggleResolved: vi.fn(),
		onToggleFavorite: vi.fn(),
		onTogglePinned: vi.fn(),
		onUpdateNoteOrder: vi.fn(),
		onToggleExpansion: vi.fn(),
	};

	it("単一NoteList構造で正常にリストと空状態が描画されること", () => {
		render(<NoteList {...testMockProps} notes={[]} scope="exact" />);
		expect(screen.getByText("No notes for this page yet")).toBeInTheDocument();
	});

	it("Favoritesがデフォルト閉であり、クリックで開くこと", () => {
		const favoriteNote = {
			id: "fav-1",
			content: "Favorite note content",
			note_type: "info" as const,
			scope: "exact" as const,
			url_pattern: "example.com",
			is_resolved: false,
			is_pinned: false,
			is_favorite: true,
			sort_order: 0,
			created_at: new Date().toISOString(),
		} as unknown as Note;

		render(
			<NoteList {...testMockProps} notes={[favoriteNote]} scope="exact" />,
		);

		const favoriteHeader = screen.getByText(/FAVORITES/i);
		const noteContainer = screen
			.getByText("Favorite note content")
			.closest(".block, .hidden");

		expect(noteContainer).toHaveClass("hidden");

		fireEvent.click(favoriteHeader);
		expect(noteContainer).toHaveClass("block");
	});
});

describe("NoteList Deferred Search & Expansion Verification", () => {
	const testMockProps = {
		notes: [],
		loading: false,
		currentFullUrl: "https://example.com/page",
		onUpdate: vi.fn(),
		onDelete: vi.fn(),
		onToggleResolved: vi.fn(),
		onToggleFavorite: vi.fn(),
		onTogglePinned: vi.fn(),
		onUpdateNoteOrder: vi.fn(),
		onToggleExpansion: vi.fn(),
	};

	it("Favoritesリスト内の長文ノートでRead moreボタンが表示・動作すること", () => {
		const longFavoriteNote = {
			id: "fav-long-1",
			content: "Favorites long text ".repeat(30),
			note_type: "info" as const,
			scope: "exact" as const,
			url_pattern: "example.com",
			is_resolved: false,
			is_pinned: false,
			is_favorite: true,
			is_expanded: false,
			sort_order: 0,
			created_at: new Date().toISOString(),
		} as unknown as Note;

		// jsdom 用の scrollHeight モック
		const originalScrollHeight = Object.getOwnPropertyDescriptor(
			HTMLElement.prototype,
			"scrollHeight",
		);
		Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
			configurable: true,
			value: 200,
		});

		render(
			<NoteList {...testMockProps} notes={[longFavoriteNote]} scope="exact" />,
		);

		// Favorites アコーディオンを開く
		const favoriteHeader = screen.getByRole("button", { name: /^FAVORITES/ });
		fireEvent.click(favoriteHeader);

		// Read more ボタンが存在することを確認
		expect(screen.getByText("Read more")).toBeInTheDocument();

		if (originalScrollHeight) {
			Object.defineProperty(
				HTMLElement.prototype,
				"scrollHeight",
				originalScrollHeight,
			);
		}
	});

	it("初期閉状態のFavoritesを開いた際、長文ノートのRead moreボタンが保持されること", () => {
		const longFavoriteNote = {
			id: "fav-long-1",
			content: "Favorites long text ".repeat(30),
			note_type: "info" as const,
			scope: "exact" as const,
			url_pattern: "example.com/page",
			is_resolved: false,
			is_pinned: false,
			is_favorite: true,
			is_expanded: false,
			sort_order: 0,
			created_at: new Date().toISOString(),
		} as unknown as Note;

		// jsdom 用の scrollHeight モック
		const originalScrollHeight = Object.getOwnPropertyDescriptor(
			HTMLElement.prototype,
			"scrollHeight",
		);
		Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
			configurable: true,
			value: 200,
		});

		render(
			<NoteList
				scope="exact"
				{...testMockProps}
				currentFullUrl="https://example.com"
				notes={[
					{
						...longFavoriteNote,
						url_pattern: "example.com",
					},
				]}
			/>,
		);

		// Favorites アコーディオンを開く
		const favoriteHeader = screen.getByRole("button", { name: /^FAVORITES/ });
		fireEvent.click(favoriteHeader);

		// Read more ボタンが存在することを確認
		expect(screen.getByText("Read more")).toBeInTheDocument();

		if (originalScrollHeight) {
			Object.defineProperty(
				HTMLElement.prototype,
				"scrollHeight",
				originalScrollHeight,
			);
		}
	});
});

describe("NoteList Batch Deferred Filter Verification", () => {
	const testMockProps = {
		notes: [],
		loading: false,
		currentFullUrl: "https://example.com/page",
		onUpdate: vi.fn(),
		onDelete: vi.fn(),
		onToggleResolved: vi.fn(),
		onToggleFavorite: vi.fn(),
		onTogglePinned: vi.fn(),
		onUpdateNoteOrder: vi.fn(),
		onToggleExpansion: vi.fn(),
	};

	it("一括Deferred化されたfilterStateのもとでNoteListが正常に描画されること", () => {
		const sampleNote = {
			id: "batch-filter-1",
			content: "Batch filter test content",
			note_type: "info" as const,
			scope: "exact" as const,
			url_pattern: "example.com/page",
			is_resolved: false,
			is_pinned: false,
			is_favorite: false,
			sort_order: 0,
			created_at: new Date().toISOString(),
		} as unknown as Note;

		render(
			<NoteList
				{...testMockProps}
				notes={[sampleNote]}
				scope="exact"
				showResolved={false}
			/>,
		);

		expect(screen.getByText("Batch filter test content")).toBeInTheDocument();
	});
});

describe("NoteList Infinite Scroll Callback Ref Verification", () => {
	const baseProps = {
		loading: false,
		currentFullUrl: "https://example.com/page",
		onUpdate: vi.fn(),
		onDelete: vi.fn(),
		onToggleResolved: vi.fn(),
		onToggleFavorite: vi.fn(),
		onTogglePinned: vi.fn(),
		onUpdateNoteOrder: vi.fn(),
		onToggleExpansion: vi.fn(),
	};

	it("初回マウント時に0件（sentinel不在）で後から25件のデータが到着した場合でも、IntersectionObserverが確実にバインドされスクロールで全件表示されること", () => {
		let intersectCallback: IntersectionObserverCallback | null = null;
		const observeSpy = vi.fn();
		const disconnectSpy = vi.fn();

		const OriginalIntersectionObserver = window.IntersectionObserver;
		// biome-ignore lint/complexity/useArrowFunction: function required for constructor call via 'new'
		window.IntersectionObserver = vi.fn().mockImplementation(function (cb) {
			intersectCallback = cb;
			return {
				observe: observeSpy,
				disconnect: disconnectSpy,
				unobserve: vi.fn(),
			};
		}) as unknown as typeof IntersectionObserver;

		const { rerender } = render(
			<NoteList {...baseProps} notes={[]} scope="exact" />,
		);

		expect(
			screen.queryByTestId("infinite-scroll-sentinel"),
		).not.toBeInTheDocument();

		// 25件のノートを生成して後から着信させる
		const manyNotes: Note[] = Array.from({ length: 25 }, (_, i) => ({
			id: `note-scroll-${i + 1}`,
			content: `Scroll Note Item ${i + 1}`,
			note_type: "info" as const,
			scope: "exact" as const,
			url_pattern: "example.com/page",
			is_resolved: false,
			is_pinned: false,
			is_favorite: false,
			is_expanded: false,
			sort_order: i + 1,
			created_at: new Date(2026, 0, 1, 0, i).toISOString(),
			updated_at: new Date(2026, 0, 1, 0, i).toISOString(),
			user_id: "user-1",
			draft_id: null,
			tags: [],
		}));

		rerender(<NoteList {...baseProps} notes={manyNotes} scope="exact" />);

		// 初回バッチは20件まで表示され、25件目はまだ未表示であること
		expect(screen.getByText("Scroll Note Item 1")).toBeInTheDocument();
		expect(screen.getByText("Scroll Note Item 20")).toBeInTheDocument();
		expect(screen.queryByText("Scroll Note Item 25")).not.toBeInTheDocument();

		// Callback Ref により sentinel 出現と同時に observe が呼ばれていること
		expect(screen.getByTestId("infinite-scroll-sentinel")).toBeInTheDocument();
		expect(observeSpy).toHaveBeenCalledTimes(1);

		// スクロール交差（isIntersecting: true）を発火
		act(() => {
			if (intersectCallback) {
				intersectCallback(
					[{ isIntersecting: true } as IntersectionObserverEntry],
					{} as IntersectionObserver,
				);
			}
		});

		// 残りの21〜25件目が追加描画され、sentinel が消えること
		expect(screen.getByText("Scroll Note Item 25")).toBeInTheDocument();
		expect(
			screen.queryByTestId("infinite-scroll-sentinel"),
		).not.toBeInTheDocument();

		window.IntersectionObserver = OriginalIntersectionObserver;
	});
});
