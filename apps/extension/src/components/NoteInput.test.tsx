import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import NoteInput from "./NoteInput";

describe("NoteInput Component", () => {
	it("入力して送信ボタンを押すと、onAddNoteが呼ばれ、入力欄がクリアされること", async () => {
		const user = userEvent.setup();
		const mockOnAddNote = vi.fn().mockResolvedValue(true);
		const mockOnClose = vi.fn();

		render(
			<NoteInput
				userPlan="free"
				totalNoteCount={10}
				maxFreeNotes={200}
				initialScope="exact"
				initialType="info"
				onAddNote={mockOnAddNote}
				onAppendDiary={vi.fn()}
				onClose={mockOnClose}
			/>,
		);

		const input = screen.getByPlaceholderText(/Add a cue to/i);
		const submitButton = screen.getByRole("button", { name: /Add Note/i });

		// 1. テキストを入力
		await user.type(input, "新しいアイデアのメモ");
		expect(input).toHaveValue("新しいアイデアのメモ");

		// 2. 送信ボタンをクリック
		await user.click(submitButton);

		// 3. onAddNoteが正しい引数で呼ばれたか検証（デフォルトは exact と info）
		await waitFor(() => {
			expect(mockOnAddNote).toHaveBeenCalledWith(
				"新しいアイデアのメモ",
				"exact",
				"info",
			);
		});

		// 4. オプティミスティック更新（300msアニメーション後）により、入力欄がクリアされているか検証
		await waitFor(() => {
			expect(input).toHaveValue("");
		});
	});

	it("無料枠の上限に達している場合、入力欄が非表示になり警告メッセージが出ること", () => {
		const mockOnClose = vi.fn();
		render(
			<NoteInput
				userPlan="free"
				totalNoteCount={200} // 上限
				maxFreeNotes={200}
				initialScope="exact"
				initialType="info"
				onAddNote={vi.fn()}
				onAppendDiary={vi.fn()}
				onClose={mockOnClose}
			/>,
		);

		// テキストボックスが存在しないことを確認
		expect(
			screen.queryByPlaceholderText(/Add a cue to/i),
		).not.toBeInTheDocument();

		// 警告メッセージが表示されていることを確認
		expect(screen.getByText(/Note Limit Reached/i)).toBeInTheDocument();
	});
});

describe("NoteInput Component - 連続作成 & IME Guard", () => {
	const defaultProps = {
		userPlan: "free" as const,
		totalNoteCount: 10,
		maxFreeNotes: 500,
		initialScope: "exact" as const,
		initialType: "info" as const,
		onAddNote: vi.fn().mockResolvedValue(true),
		onAppendDiary: vi.fn().mockResolvedValue(true),
		onClose: vi.fn(),
		textareaRef: {
			current: null,
		} as unknown as React.RefObject<HTMLTextAreaElement | null>,
	};

	it("Ctrl+EnterでのSubmit時、入力内容がクリアされ、onAddNoteが正しく呼び出されること", async () => {
		const mockOnAddNote = vi.fn().mockResolvedValue(true);
		render(<NoteInput {...defaultProps} onAddNote={mockOnAddNote} />);
		const textarea = screen.getByPlaceholderText(/Add a cue to/i);

		fireEvent.change(textarea, { target: { value: "ササッと連続連続メモ" } });
		expect(textarea).toHaveValue("ササッと連続連続メモ");

		fireEvent.focus(textarea);
		fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });

		await waitFor(() => {
			expect(mockOnAddNote).toHaveBeenCalledWith(
				"ササッと連続連続メモ",
				"exact",
				"info",
			);
		});
	});

	it("IME変換中のEnter（isComposing=true）ではSubmitがガードされ発火しないこと", () => {
		const mockOnAddNote = vi.fn().mockResolvedValue(true);
		render(<NoteInput {...defaultProps} onAddNote={mockOnAddNote} />);
		const textarea = screen.getByPlaceholderText(/Add a cue to/i);

		fireEvent.change(textarea, { target: { value: "漢字変換中" } });

		fireEvent.focus(textarea);
		// nativeEvent.isComposing = true をシミュレート
		const event = new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true });
		Object.defineProperty(event, "nativeEvent", {
			value: { isComposing: true },
		});

		textarea.dispatchEvent(event);

		expect(mockOnAddNote).not.toHaveBeenCalled();
	});
});

describe("NoteInput + Diary Integration Split Test", () => {
	it("ノート入力欄でのCtrl+Enterと、日記入力欄でのCtrl+Enterが個別に正しいハンドラーをトリガーすること", async () => {
		const user = userEvent.setup();
		const mockAddNote = vi.fn().mockResolvedValue(true);
		const mockAppendDiary = vi.fn().mockResolvedValue(true);
		const mockClose = vi.fn();

		render(
			<NoteInput
				userPlan="free"
				totalNoteCount={10}
				maxFreeNotes={500}
				initialScope="exact"
				initialType="info"
				onAddNote={mockAddNote}
				onAppendDiary={mockAppendDiary}
				onClose={mockClose}
			/>,
		);

		// 1. ノート用テキストエリアの検証
		const noteTextarea = screen.getByPlaceholderText(/Add a cue to/i);
		fireEvent.focus(noteTextarea);
		fireEvent.change(noteTextarea, {
			target: { value: "Note Content via Test" },
		});
		fireEvent.keyDown(noteTextarea, { key: "Enter", ctrlKey: true });
		await waitFor(() => {
			expect(mockAddNote).toHaveBeenCalledWith(
				"Note Content via Test",
				"exact",
				"info",
			);
		});
		expect(mockAppendDiary).not.toHaveBeenCalled();

		vi.clearAllMocks();

		// 2. 日記用テキストエリアの検証
		const diaryTextarea = screen.getByPlaceholderText(/Append log text/i);
		await user.type(
			diaryTextarea,
			"Diary Segment via Test{Control>}{Enter}{/Control}",
		);
		await waitFor(() => {
			expect(mockAppendDiary).toHaveBeenCalledWith("Diary Segment via Test");
		});
		expect(mockAddNote).not.toHaveBeenCalled();
	});

	it("日記入力欄で送信ボタンを押すとonAppendDiaryが呼ばれ、成功時にonCloseが呼ばれること", async () => {
		const mockAppendDiary = vi.fn().mockResolvedValue(true);
		const mockClose = vi.fn();
		render(
			<NoteInput
				maxFreeNotes={500}
				initialScope="exact"
				initialType="info"
				onAddNote={vi.fn()}
				onAppendDiary={mockAppendDiary}
				onClose={mockClose}
				totalNoteCount={10}
				userPlan="free"
			/>,
		);

		const diaryTextarea = screen.getByPlaceholderText(/Append log text/i);
		fireEvent.focus(diaryTextarea);
		fireEvent.change(diaryTextarea, {
			target: { value: "Test Submit Button" },
		});

		// 日記の島の送信ボタン (title="Append to Diary" 等で特定)
		const diarySubmitBtn = screen.getByTitle("Append to Diary");
		fireEvent.click(diarySubmitBtn);

		await waitFor(() => {
			expect(mockAppendDiary).toHaveBeenCalledWith("Test Submit Button");
			expect(mockClose).toHaveBeenCalled(); // 成功時クローズ
		});
	});
});

describe("NoteInput Component - Integrated 2-Block Sync Test", () => {
	const defaultProps = {
		userPlan: "free" as const,
		totalNoteCount: 10,
		maxFreeNotes: 500,
		initialScope: "exact" as const,
		initialType: "info" as const,
		onAddNote: vi.fn().mockResolvedValue(true),
		onAppendDiary: vi.fn().mockResolvedValue(true),
		onClose: vi.fn(),
	};

	it("初期レンダリング時、親コンテキストから渡されたScopeとTypeがSelectボタン群に正しく反映されていること", () => {
		render(
			<NoteInput {...defaultProps} initialScope="domain" initialType="idea" />,
		);

		// select要素内にSyncされているか検証
		const selectEl = screen.getByRole("combobox");
		expect(selectEl).toBeInTheDocument();
		expect(selectEl).toHaveValue("domain");

		// Type Selector の Idea ボタンのアクティブ状態の検証
		const ideaButton = screen.getByTitle("Idea");
		expect(ideaButton.className).toContain("bg-note-idea");
	});

	it("Diaryセクションが並列島コンテナとして Today の文脈で独立して存在すること", () => {
		render(<NoteInput {...defaultProps} />);
		expect(screen.getByText(/Today's Diary/i)).toBeInTheDocument();
		expect(screen.getByPlaceholderText(/Append log text/i)).toBeInTheDocument();
	});
});

describe("NoteInput Select UI Component Tests", () => {
	const mockProps = {
		userPlan: "free" as const,
		totalNoteCount: 5,
		maxFreeNotes: 500,
		initialScope: "exact" as const,
		initialType: "info" as const,
		onAddNote: vi.fn().mockResolvedValue(true),
		onAppendDiary: vi.fn().mockResolvedValue(true),
		onClose: vi.fn(),
	};

	it("Page/Domain/Inboxがネイティブselect要素内にマウントされ、初期値が正しく同期されていること", () => {
		render(<NoteInput {...mockProps} initialScope="domain" />);

		const selectEl = screen.getByRole("combobox");
		expect(selectEl).toBeInTheDocument();
		expect(selectEl).toHaveValue("domain");
	});

	it("非アクティブ側のSubmitボタンが排他的にdisabledになり、誤送信を防ぐこと", () => {
		render(<NoteInput {...mockProps} />);

		// デフォルトは Note 側がアクティブなため、Diary 側の送信ボタンは不活性
		const diarySubmitBtn = screen.getByTitle("Append to Diary");
		expect(diarySubmitBtn).toBeDisabled();

		// Diary 側のテキストエリアへフォーカスをシミュレートし、テキストを入力
		const diaryTextarea = screen.getByPlaceholderText(/Append log text/i);
		fireEvent.focus(diaryTextarea);
		fireEvent.change(diaryTextarea, {
			target: { value: "Diary content text" },
		});

		// 反転して Note 側の送信ボタンが disabled になること
		const noteSubmitBtn = screen.getByTitle("Add Note");
		expect(noteSubmitBtn).toBeDisabled();
		expect(diarySubmitBtn).not.toBeDisabled();
	});
});

describe("NoteInput Component - Dynamic Plans and Limits", () => {
	const mockOnAddNote = vi.fn().mockResolvedValue(true);
	const mockOnAppendDiary = vi.fn().mockResolvedValue(true);
	const mockOnClose = vi.fn();

	it("freeプランでノート上限に達している場合、警告文言が表示され送信ボタンが非活性化すること", () => {
		render(
			<NoteInput
				initialScope="exact"
				initialType="all"
				maxFreeNotes={500}
				onAddNote={mockOnAddNote}
				onAppendDiary={mockOnAppendDiary}
				onClose={mockOnClose}
				totalNoteCount={500}
				userPlan="free"
			/>,
		);

		expect(screen.getByText(/Note Limit Reached/i)).toBeInTheDocument();
		const submitButton = screen.getByTitle("Add Note");
		expect(submitButton).toBeDisabled();
	});

	it("proプランの場合、500件を超えていても件数制限警告が表示されず送信可能なこと", () => {
		render(
			<NoteInput
				initialScope="exact"
				initialType="all"
				maxFreeNotes={500}
				onAddNote={mockOnAddNote}
				onAppendDiary={mockOnAppendDiary}
				onClose={mockOnClose}
				totalNoteCount={550}
				userPlan="pro"
			/>,
		);

		expect(screen.queryByText(/Note Limit Reached/i)).not.toBeInTheDocument();
		const textarea = screen.getByPlaceholderText(/Add a cue to/i);
		fireEvent.change(textarea, { target: { value: "Test Pro Content" } });

		const submitButton = screen.getByTitle("Add Note");
		expect(submitButton).not.toBeDisabled();
	});

	it("10,000文字を超えた入力がある場合はFreeプランで送信ボタンが非活性化すること", () => {
		render(
			<NoteInput
				initialScope="exact"
				initialType="all"
				maxFreeNotes={500}
				onAddNote={mockOnAddNote}
				onAppendDiary={mockOnAppendDiary}
				onClose={mockOnClose}
				totalNoteCount={10}
				userPlan="free"
			/>,
		);

		const textarea = screen.getByPlaceholderText(/Add a cue to/i);
		const overLimitText = "a".repeat(10001);
		fireEvent.change(textarea, { target: { value: overLimitText } });

		const submitButton = screen.getByTitle("Add Note");
		expect(submitButton).toBeDisabled();
		expect(screen.getByText("10,001 / 10,000")).toHaveClass("text-note-alert");
	});
});

describe("NoteInput Component - Slide Out & Auto-Recovery on Failure", () => {
	it("onAddNoteがfalse(失敗)を返した場合、テキストが自動復元されtoast.errorが呼ばれること", async () => {
		const mockOnAddNote = vi.fn().mockResolvedValue(false); // 失敗レスポンス
		render(
			<NoteInput
				initialScope="exact"
				initialType="info"
				maxFreeNotes={500}
				onAddNote={mockOnAddNote}
				onAppendDiary={vi.fn()}
				onClose={vi.fn()}
				totalNoteCount={10}
				userPlan="free"
			/>,
		);

		const textarea = screen.getByPlaceholderText(/Add a cue to/i);
		const submitBtn = screen.getByTitle("Add Note");

		fireEvent.change(textarea, {
			target: { value: "重要で消えてはいけない長文テキスト" },
		});
		fireEvent.click(submitBtn);

		await waitFor(() => {
			expect(mockOnAddNote).toHaveBeenCalledWith(
				"重要で消えてはいけない長文テキスト",
				"exact",
				"info",
			);
		});

		// 復元されたテキストがテキストエリアに戻っていることを検証
		await waitFor(() => {
			expect(textarea).toHaveValue("重要で消えてはいけない長文テキスト");
		});
	});
});

describe("NoteInput Component - Markdown Assist Integration", () => {
	const defaultProps = {
		userPlan: "free" as const,
		totalNoteCount: 10,
		maxFreeNotes: 500,
		initialScope: "exact" as const,
		initialType: "info" as const,
		onAddNote: vi.fn().mockResolvedValue(true),
		onAppendDiary: vi.fn().mockResolvedValue(true),
		onClose: vi.fn(),
	};

	it("Note入力欄およびDiary入力欄で、リスト行のEnterによるオートバレットと括弧ペア補完が機能すること", () => {
		render(<NoteInput {...defaultProps} />);

		// 1. Note入力欄でのオートバレット検証
		const noteTextarea = screen.getByPlaceholderText(
			/Add a cue to/i,
		) as HTMLTextAreaElement;
		fireEvent.focus(noteTextarea);
		fireEvent.change(noteTextarea, { target: { value: "- item 1" } });
		noteTextarea.setSelectionRange(8, 8);
		fireEvent.keyDown(noteTextarea, { key: "Enter" });

		expect(noteTextarea.value).toBe("- item 1\n- ");

		// 2. Diary入力欄での括弧補完検証
		const diaryTextarea = screen.getByPlaceholderText(
			/Append log text/i,
		) as HTMLTextAreaElement;
		fireEvent.focus(diaryTextarea);
		fireEvent.change(diaryTextarea, { target: { value: "" } });
		diaryTextarea.setSelectionRange(0, 0);
		fireEvent.keyDown(diaryTextarea, { key: "[" });

		expect(diaryTextarea.value).toBe("[]");
	});
});
