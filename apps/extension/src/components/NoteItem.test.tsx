import { act, fireEvent, render, screen } from "@testing-library/react";
import { type ComponentProps, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { AuthStatus } from "../hooks/useAuth";
import type { Note } from "../hooks/useNotes";
import Header from "./Header";
import NoteItem from "./NoteItem";

const NoteItemTestWrapper = ({
	note,
	onUpdate = vi.fn().mockResolvedValue(true),
	onDelete = vi.fn().mockResolvedValue(true),
	onToggleResolved = vi.fn().mockResolvedValue(true),
	onToggleFavorite = vi.fn().mockResolvedValue(true),
	onTogglePinned = vi.fn().mockResolvedValue(true),
	onToggleExpansion = vi.fn().mockResolvedValue(true),
	currentFullUrl = "https://example.com/page",
	isFavoriteList = false,
	isPreview = false,
}: Partial<ComponentProps<typeof NoteItem>> & { note: Note }) => {
	const [isEditing, setIsEditing] = useState(false);
	const [_isEditDirty, setIsEditDirty] = useState(false);

	return (
		<NoteItem
			note={note}
			currentFullUrl={currentFullUrl}
			isFavoriteList={isFavoriteList}
			isEditing={isEditing}
			onRequestEdit={(id) => setIsEditing(!!id)}
			onSetIsEditDirty={setIsEditDirty}
			onUpdate={onUpdate}
			onDelete={onDelete}
			onToggleResolved={onToggleResolved}
			onToggleFavorite={onToggleFavorite}
			onTogglePinned={onTogglePinned}
			onToggleExpansion={onToggleExpansion}
			isPreview={isPreview}
		/>
	);
};

describe("NoteItem Component", () => {
	const mockNote: Note = {
		id: "note-999",
		content: "Test note for layout sync #idea",
		note_type: "idea",
		scope: "exact",
		is_resolved: false,
		is_favorite: false,
		is_pinned: false,
		is_expanded: false,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		user_id: "user-1",
		url_pattern: "example.com/page",
		sort_order: 0,
		tags: ["idea"],
	} as unknown as Note;

	it("1段に統合されたヘッダー内にアクションボタン（Copy, Edit, Delete）やPin/Starボタンが正しく配置され機能すること", async () => {
		const mockOnDelete = vi.fn().mockResolvedValue(true);
		const mockOnToggleFavorite = vi.fn().mockResolvedValue(true);
		const mockOnTogglePinned = vi.fn().mockResolvedValue(true);

		render(
			<NoteItemTestWrapper
				note={mockNote}
				onDelete={mockOnDelete}
				onToggleFavorite={mockOnToggleFavorite}
				onTogglePinned={mockOnTogglePinned}
			/>,
		);

		// 1段ヘッダー内の各ボタンの存在表明
		const copyButton = screen.getByTitle("Copy note");
		const editButton = screen.getByTitle("Edit");
		const deleteButton = screen.getByTitle("Delete");
		const favoriteButton = screen.getByTitle("Add to favorites");
		const pinButton = screen.getByTitle("Pin note");

		expect(copyButton).toBeInTheDocument();
		expect(editButton).toBeInTheDocument();
		expect(deleteButton).toBeInTheDocument();
		expect(favoriteButton).toBeInTheDocument();
		expect(pinButton).toBeInTheDocument();

		// Pinned テキストは1段化に伴い撤去されているため、存在しないことを確認
		expect(screen.queryByText("Pinned")).not.toBeInTheDocument();

		// ユーザー操作の振る舞い検証
		fireEvent.click(deleteButton);
		expect(mockOnDelete).toHaveBeenCalledWith("note-999");

		fireEvent.click(favoriteButton);
		expect(mockOnToggleFavorite).toHaveBeenCalledWith(mockNote);

		fireEvent.click(pinButton);
		expect(mockOnTogglePinned).toHaveBeenCalledWith(mockNote);
	});

	it("編集モード移行時に2段構成Sticky編集ヘッダー（決定アクション、セレクトUI、属性セレクター）が正しく描画され、無変更ガードが機能すること", async () => {
		const mockOnUpdate = vi.fn().mockResolvedValue(true);

		render(<NoteItemTestWrapper note={mockNote} onUpdate={mockOnUpdate} />);

		// 編集モードを起動
		const editButton = screen.getByTitle("Edit");
		fireEvent.click(editButton);

		// 1段目決定テキストアクション、2段目セレクトUI、コンテキストの存在表明
		const cancelButton = screen.getByRole("button", { name: /Cancel/i });
		const saveButton = screen.getByRole("button", { name: /Save/i });
		expect(cancelButton).toBeInTheDocument();
		expect(saveButton).toBeInTheDocument();

		// 編集中のインジケーターテキスト確認
		expect(screen.getByText("Editing note...")).toBeInTheDocument();

		const scopeSelect = screen.getByRole("combobox");
		expect(scopeSelect).toBeInTheDocument();
		expect(scopeSelect).toHaveValue("exact");

		// 初期状態は内容が「無変更」であるため、Saveボタンがdisabledになっていることを検証
		expect(saveButton).toBeDisabled();

		// スコープの変更インタラクション検証
		fireEvent.change(scopeSelect, { target: { value: "domain" } });
		// 変更されたためガードが解除され、有効化されることを検証
		expect(saveButton).not.toBeDisabled();

		// タイプカプセルのトグル検証（IdeaからAlertへ切り替え）
		const alertTypeButton = screen.getByTitle("Alert");
		fireEvent.click(alertTypeButton);

		// テキスト変更による送信検証
		const textarea = screen.getByRole("textbox");
		fireEvent.change(textarea, {
			target: { value: "Updated content text #test" },
		});

		fireEvent.click(saveButton);
		expect(mockOnUpdate).toHaveBeenCalledWith(
			"note-999",
			"Updated content text #test",
			"alert",
			"domain",
		);
	});

	it("isPreviewがtrueの場合、GripVerticalハンドルやアクションボタン（Copy, Edit, Delete）が非表示になること", () => {
		render(<NoteItemTestWrapper note={mockNote} isPreview={true} />);

		expect(screen.queryByTitle("Drag to reorder")).not.toBeInTheDocument();
		expect(screen.queryByTitle("Copy note")).not.toBeInTheDocument();
		expect(screen.queryByTitle("Edit")).not.toBeInTheDocument();
		expect(screen.queryByTitle("Delete")).not.toBeInTheDocument();
	});

	it("初期マウント時にcontentが空（Slim Fetching）かつ非表示（scrollHeight=0）であっても、Hydrationで長文かつis_expanded=trueが到着した際にShow lessボタンが表示され折りたためること", () => {
		const mockOnToggleExpansion = vi.fn().mockResolvedValue(true);
		const originalScrollHeight = Object.getOwnPropertyDescriptor(
			HTMLElement.prototype,
			"scrollHeight",
		);
		Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
			configurable: true,
			value: 0,
		});

		const slimFavoriteNote: Note = {
			...mockNote,
			id: "fav-hydrated-1",
			content: "",
			is_favorite: true,
			is_expanded: true,
		};

		const { rerender } = render(
			<NoteItemTestWrapper
				note={slimFavoriteNote}
				isFavoriteList={true}
				onToggleExpansion={mockOnToggleExpansion}
			/>,
		);

		expect(screen.queryByText("Show less")).not.toBeInTheDocument();

		// 本文 Hydration 完了をシミュレート
		const hydratedNote: Note = {
			...slimFavoriteNote,
			content: "Long favorite note content ".repeat(20),
		};

		rerender(
			<NoteItemTestWrapper
				note={hydratedNote}
				isFavoriteList={true}
				onToggleExpansion={mockOnToggleExpansion}
			/>,
		);

		const showLessBtn = screen.getByText("Show less");
		expect(showLessBtn).toBeInTheDocument();

		fireEvent.click(showLessBtn);
		expect(mockOnToggleExpansion).toHaveBeenCalledWith("fav-hydrated-1", true);

		if (originalScrollHeight) {
			Object.defineProperty(
				HTMLElement.prototype,
				"scrollHeight",
				originalScrollHeight,
			);
		}
	});

	it("ResizeObserver発火時（アコーディオン開放でscrollHeightが0から200へ変化した際）、isOverflowingが再評価されShow lessボタンが表示されること", () => {
		let resizeCallback: ResizeObserverCallback | null = null;
		const OriginalResizeObserver = window.ResizeObserver;
		// biome-ignore lint/complexity/useArrowFunction: function required for constructor call via 'new'
		window.ResizeObserver = vi.fn().mockImplementation(function (cb) {
			resizeCallback = cb;
			return {
				observe: vi.fn(),
				disconnect: vi.fn(),
				unobserve: vi.fn(),
			};
		}) as unknown as typeof ResizeObserver;

		const originalScrollHeight = Object.getOwnPropertyDescriptor(
			HTMLElement.prototype,
			"scrollHeight",
		);
		Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
			configurable: true,
			value: 0,
		});

		// 120文字以下だが改行等で実寸高さが160pxを超える展開済みノート
		const multilineExpandedNote: Note = {
			...mockNote,
			id: "fav-resize-1",
			content: "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8",
			is_favorite: true,
			is_expanded: true,
		};

		render(
			<NoteItemTestWrapper
				note={multilineExpandedNote}
				isFavoriteList={true}
			/>,
		);

		// 非表示（scrollHeight=0 かつ 120文字以下）のため初期は未表示
		expect(screen.queryByText("Show less")).not.toBeInTheDocument();

		// アコーディオンが開いて実寸高さが 220px になった状態をシミュレート
		Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
			configurable: true,
			value: 220,
		});

		act(() => {
			if (resizeCallback) {
				(resizeCallback as () => void)();
			}
		});

		expect(screen.getByText("Show less")).toBeInTheDocument();

		if (originalScrollHeight) {
			Object.defineProperty(
				HTMLElement.prototype,
				"scrollHeight",
				originalScrollHeight,
			);
		}
		window.ResizeObserver = OriginalResizeObserver;
	});
});

describe("Header - Lock Button & Title Settings Trigger", () => {
	it("タイトルをクリックすると設定エリアがトグルし、鍵ボタンクリックでonToggleLockが呼ばれること", () => {
		const onToggleLockMock = vi.fn();
		const authStatus: AuthStatus = {
			mode: "guest",
			session: null,
			userId: "guest-user",
		};

		render(
			<Header
				url="https://example.com/page"
				title="Example Page"
				domain="example.com"
				session={null}
				onLogout={vi.fn()}
				authStatus={authStatus}
				isLocked={false}
				onToggleLock={onToggleLockMock}
			/>,
		);

		// 1. 鍵アイコン（非ロック時は Lock URL）の検証とクリック
		const lockButton = screen.getByRole("button", { name: /^Lock URL$/i });
		expect(lockButton).toBeInTheDocument();
		fireEvent.click(lockButton);
		expect(onToggleLockMock).toHaveBeenCalledTimes(1);

		// 2. タイトルクリックによる設定パネル開閉の検証
		const titleButton = screen.getByRole("button", { name: /Example Page/i });
		expect(screen.queryByLabelText(/Label/i)).not.toBeInTheDocument();

		fireEvent.click(titleButton);
		expect(screen.getByLabelText(/Label/i)).toBeInTheDocument();

		fireEvent.click(titleButton);
		expect(screen.queryByLabelText(/Label/i)).not.toBeInTheDocument();
	});
});
