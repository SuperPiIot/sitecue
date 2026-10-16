import { SHARED_LIMITS } from "@sitecue/shared";
import {
	AlertTriangle,
	CalendarDays,
	Info,
	Lightbulb,
	Send,
	X,
} from "lucide-react";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import TextareaAutosize from "react-textarea-autosize";
import { useMarkdownAssist } from "../hooks/useMarkdownAssist";
import type { NoteScope, NoteType } from "../hooks/useNotes";

interface NoteInputProps {
	userPlan: "free" | "pro" | "guest";
	totalNoteCount: number;
	maxFreeNotes: number;
	initialScope: NoteScope;
	initialType: "all" | "info" | "alert" | "idea";
	onAddNote: (
		content: string,
		scope: NoteScope,
		type: NoteType,
	) => Promise<boolean>;
	onAppendDiary: (content: string) => Promise<boolean>;
	onClose: () => void;
	textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export default function NoteInput({
	userPlan,
	totalNoteCount,
	maxFreeNotes,
	initialScope,
	initialType,
	onAddNote,
	onAppendDiary,
	onClose,
	textareaRef,
}: NoteInputProps) {
	const [activeType, setActiveType] = useState<"note" | "diary">("note");
	const [selectedScope, setSelectedScope] = useState<NoteScope>(
		initialScope === "inbox" ? "inbox" : initialScope,
	);
	const [selectedType, setSelectedType] = useState<NoteType>(
		initialType === "all" ? "info" : initialType,
	);
	const [newNote, setNewNote] = useState("");
	const [diaryText, setDiaryText] = useState("");
	const [isSlidingNote, setIsSlidingNote] = useState(false);
	const [isSlidingDiary, setIsSlidingDiary] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const pendingNoteRef = useRef("");
	const pendingDiaryRef = useRef("");

	const { onKeyDown: handleMarkdownKeyDown, onPaste: handleMarkdownPaste } =
		useMarkdownAssist();

	const maxNoteCharLength =
		userPlan === "pro"
			? SHARED_LIMITS.NOTE_LENGTH.PRO
			: SHARED_LIMITS.NOTE_LENGTH.FREE;

	const handleDiarySubmit = async () => {
		const content = diaryText.trim();
		if (!content || submitting) return;

		setSubmitting(true);
		pendingDiaryRef.current = content;

		// 1. スライド発火 (0ms)
		setIsSlidingDiary(true);

		// 2. 300ms アニメーション完了を優雅に待機
		await new Promise((resolve) => setTimeout(resolve, 300));

		// 3. 通信実行
		const success = await onAppendDiary(content);
		setSubmitting(false);

		if (!success) {
			// 失敗時のみロールバック（復元）
			setIsSlidingDiary(false);
			setDiaryText(pendingDiaryRef.current);
			toast.error("Failed to send text");
		} else {
			// 🌟 成功時: フォームをリセット（isSlidingDiary=false）せず、消えた状態(opacity-0)のままダイアログを即時閉鎖！
			// これにより、閉じる直前の「空フォーム露出フラッシュ」を100%防止。
			onClose();
		}
	};

	const isFreeOrGuest = userPlan === "free" || userPlan === "guest";
	const isNearLimit = isFreeOrGuest && totalNoteCount >= maxFreeNotes * 0.9;
	const isLimitReached = isFreeOrGuest && totalNoteCount >= maxFreeNotes;

	const charCount = newNote.length;
	const isCharNearLimit = charCount >= maxNoteCharLength * 0.9;
	const isCharOverLimit = charCount > maxNoteCharLength;

	const handleSubmit = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		const content = newNote.trim();
		if (!content || isCharOverLimit || submitting) return;

		setSubmitting(true);
		pendingNoteRef.current = content;

		// 1. スライド発火 (0ms)
		setIsSlidingNote(true);

		// 2. 300ms アニメーション完了を優雅に待機
		await new Promise((resolve) => setTimeout(resolve, 300));

		// 3. テキストクリア＆0msでスタイル定位置復帰（巻き戻りなし）
		setNewNote("");
		setIsSlidingNote(false);
		textareaRef?.current?.focus();

		// 4. 通信実行
		const success = await onAddNote(content, selectedScope, selectedType);
		setSubmitting(false);

		if (!success) {
			setNewNote(pendingNoteRef.current);
			toast.error("Failed to send text");
		}
	};

	// 選択されたタイプに応じたLucideアイコンを決定するヘルパー
	const renderTypeIcon = () => {
		if (selectedType === "alert")
			return <AlertTriangle className="w-4 h-4 text-note-alert" />;
		if (selectedType === "idea")
			return <Lightbulb className="w-4 h-4 text-note-idea" />;
		return <Info className="w-4 h-4 text-note-info" />;
	};

	return (
		<div className="bg-base-surface border border-base-border/70 rounded-2xl shadow-2xl p-4 pt-7 relative flex flex-col gap-3 w-full min-w-0 font-sans">
			{/* 右上の閉じるボタン：被らないように、かつ飛び出しすぎない適切な位置へ絶対配置 */}
			<button
				type="button"
				onClick={onClose}
				className="absolute top-1 right-1 p-1.5 rounded-full text-muted-foreground hover:text-base-text hover:bg-base-border transition-all z-50 cursor-pointer"
				title="Close input"
			>
				<X aria-hidden="true" className="w-3.5 h-3.5" />
			</button>

			{/* --- 🌟 浮かび上がるカプセル型浮き島：Noteブロック --- */}
			{/* biome-ignore lint/a11y/useSemanticElements: interaction container for layout active status */}
			<div
				onClick={() => setActiveType("note")}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						setActiveType("note");
					}
				}}
				role="button"
				tabIndex={0}
				className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 p-2 border rounded-4xl transition-all duration-200 text-left ${
					activeType === "note"
						? "bg-white border-base-border opacity-100"
						: "bg-transparent border-transparent opacity-45 hover:opacity-60"
				}`}
			>
				{/* 左側: タイプ切り替えと連動するインラインアイコン */}
				<div className="shrink-0 size-8 flex items-center justify-center bg-base-surface rounded-full border border-base-border/30 shadow-2xs">
					{renderTypeIcon()}
				</div>

				{/* 中央エリア: [上] タイトル風Select要素、[下] 最大高ガード付き入力エリア */}
				<div className="flex flex-col min-w-0 w-full gap-0.5">
					<div className="flex items-center justify-between w-full shrink-0 relative">
						{/* 枠線のない、タイトルライクな太字極小セレクトコントロール */}
						<div className="relative flex items-center">
							<select
								value={selectedScope}
								onChange={(e) => setSelectedScope(e.target.value as NoteScope)}
								onClick={(e) => e.stopPropagation()}
								className="cursor-pointer appearance-none bg-transparent pr-3 py-0 text-xs font-bold text-neutral-800 focus:outline-none select-none border-none ring-0 focus:ring-0"
							>
								<option value="exact">Page Note</option>
								<option value="domain">Domain Note</option>
								<option value="inbox">Inbox Note</option>
							</select>
							<div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400 text-[8px]">
								▼
							</div>
						</div>

						{/* Note Type Selector: カプセル背景。アクティブ時のみインライン表示、または常時表示 */}
						{/* biome-ignore lint/a11y/useKeyWithClickEvents: click handler to stop event propagation */}
						{/* biome-ignore lint/a11y/noStaticElementInteractions: click handler to stop event propagation */}
						<div
							className="flex p-1 rounded-full bg-base-surface border-base-border shrink-0 scale-85 origin-right"
							onClick={(e) => e.stopPropagation()}
						>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									setSelectedType("info");
								}}
								className={`cursor-pointer p-0.5 rounded-full ${
									selectedType === "info"
										? "bg-note-info/80 text-white"
										: "text-muted-foreground hover:text-note-info"
								}`}
								title="Info"
							>
								<Info className="size-4" aria-hidden="true" />
							</button>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									setSelectedType("alert");
								}}
								className={`cursor-pointer p-0.5 ml-0.5 rounded-full ${
									selectedType === "alert"
										? "bg-note-alert/80 text-white"
										: "text-muted-foreground hover:text-note-alert"
								}`}
								title="Alert"
							>
								<AlertTriangle className="size-4" aria-hidden="true" />
							</button>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									setSelectedType("idea");
								}}
								className={`cursor-pointer p-0.5 ml-0.5 rounded-full ${
									selectedType === "idea"
										? "bg-note-idea/80 text-white"
										: "text-muted-foreground hover:text-note-idea"
								}`}
								title="Idea"
							>
								<Lightbulb className="size-4" aria-hidden="true" />
							</button>
						</div>
					</div>

					{(userPlan === "free" || userPlan === "guest") &&
						isNearLimit &&
						!isLimitReached && (
							<div className="flex items-start gap-2 p-2 mb-2 text-xs text-note-alert bg-note-alert/10 border border-note-alert/20 rounded">
								<AlertTriangle
									className="w-4 h-4 shrink-0 mt-0.5"
									aria-hidden="true"
								/>
								<p>
									Approaching limit ({totalNoteCount}/{maxFreeNotes}). Please
									visit
									{userPlan === "guest"
										? " Login screen to sign in"
										: " Basecamp"}{" "}
									to free up space or unlock unlimited notes.
								</p>
							</div>
						)}

					{(userPlan === "free" || userPlan === "guest") && isLimitReached ? (
						<div className="w-full bg-note-idea/10 border border-note-idea/20 rounded-lg p-3 text-sm text-note-idea flex items-start gap-3">
							<AlertTriangle
								className="w-5 h-5 shrink-0 mt-0.5"
								aria-hidden="true"
							/>
							<div>
								<div className="font-bold mb-1">Note Limit Reached</div>
								<p className="text-xs opacity-90">
									You have reached the {maxFreeNotes}-note limit. Please visit
									{userPlan === "guest"
										? " Login screen to sign in"
										: " Basecamp"}{" "}
									to free up space or upgrade for unlimited access.
								</p>
							</div>
						</div>
					) : (
						<div className="relative w-full overflow-hidden">
							<div
								className={
									isSlidingNote
										? "transition-all duration-300 ease-out translate-x-full opacity-0 pointer-events-none"
										: "transition-none"
								}
							>
								<TextareaAutosize
									ref={textareaRef}
									value={newNote}
									onFocus={() => setActiveType("note")}
									onChange={(e) => setNewNote(e.target.value)}
									placeholder={`Add a cue to ${
										selectedScope === "inbox"
											? "Inbox"
											: selectedScope === "domain"
												? "this domain"
												: "this page"
									}...`}
									className="w-full resize-none border-none p-0 text-sm focus:outline-none bg-transparent text-neutral-900 focus:ring-0 placeholder:text-neutral-400 max-h-24 overflow-y-auto scrollbar-none transition-[height] duration-300 ease-out"
									minRows={1}
									onKeyDown={(e) => {
										if (e.nativeEvent.isComposing) return; // IME Guard
										if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
											e.preventDefault();
											if (newNote.trim()) {
												handleSubmit(e);
											}
										} else {
											handleMarkdownKeyDown(e);
										}
									}}
									onPaste={handleMarkdownPaste}
								/>
								{isCharNearLimit && (
									<div className="absolute right-0 bottom-0 pointer-events-none pb-1">
										<span
											className={`text-[9px] font-bold ${
												isCharOverLimit ? "text-note-alert" : "text-note-idea"
											}`}
										>
											{charCount.toLocaleString()} /{" "}
											{maxNoteCharLength.toLocaleString()}
										</span>
									</div>
								)}
							</div>
						</div>
					)}
				</div>

				{/* 右側: カプセル内部に完全にアラインされた送信ボタン（items-center で常に垂直中央ロック） */}
				<button
					disabled={
						activeType !== "note" ||
						!newNote.trim() ||
						isCharOverLimit ||
						isLimitReached ||
						submitting
					}
					type="button"
					onClick={handleSubmit}
					className="cursor-pointer bg-action text-action-text w-8 h-8 rounded-full flex items-center justify-center hover:bg-action-hover disabled:opacity-10 disabled:cursor-not-allowed transition-all shadow-2xs shrink-0"
					title="Add Note"
				>
					<Send aria-hidden="true" className="w-3.5 h-3.5" />
				</button>
			</div>

			{/* --- 🌟 浮かび上がるカプセル型浮き島: Diaryブロック --- */}
			{/* biome-ignore lint/a11y/useSemanticElements: interaction container for layout active status */}
			<div
				onClick={() => setActiveType("diary")}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						setActiveType("diary");
					}
				}}
				role="button"
				tabIndex={0}
				className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 p-2 rounded-4xl border transition-all duration-200 text-left ${
					activeType === "diary"
						? "bg-white border-base-border opacity-100"
						: "bg-transparent border-transparent opacity-45 hover:opacity-60"
				}`}
			>
				{/* 左側: 固定日記アイコン */}
				<div className="shrink-0 size-8 flex items-center justify-center bg-base-surface rounded-full border border-base-border/30 shadow-2xs text-muted-foreground">
					<CalendarDays className="w-4 h-4 text-neutral-500" />
				</div>

				{/* 中央エリア */}
				<div className="flex flex-col min-w-0 w-full gap-0.5">
					<div className="text-xs font-bold text-neutral-800 tracking-wide select-none px-0.5 mb-1">
						Today's Diary
					</div>
					{/* 🌟 1. 固定マスク親ラッパー (overflow-hidden) */}
					<div className="w-full overflow-hidden">
						{/* 🌟 2. スライド駆動子コンテナ (isSlidingDiary に連動) */}
						<div
							className={
								isSlidingDiary
									? "transition-all duration-300 ease-out translate-x-full opacity-0 pointer-events-none"
									: "transition-none"
							}
						>
							<TextareaAutosize
								value={diaryText}
								onFocus={() => setActiveType("diary")}
								onChange={(e) => setDiaryText(e.target.value)}
								placeholder="Append log text..."
								className="w-full resize-none border-none p-0 text-sm focus:outline-none bg-transparent text-neutral-900 focus:ring-0 placeholder:text-neutral-400 max-h-24 overflow-y-auto scrollbar-none transition-[height] duration-300 ease-out"
								minRows={1}
								onKeyDown={(e) => {
									if (e.nativeEvent.isComposing) return; // IME Guard
									if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
										e.preventDefault();
										if (diaryText.trim()) {
											handleDiarySubmit();
										}
									} else {
										handleMarkdownKeyDown(e);
									}
								}}
								onPaste={handleMarkdownPaste}
							/>
						</div>
					</div>
				</div>

				{/* 右側: 送信ボタン（items-center で常に垂直中央ロック） */}
				<button
					type="button"
					onClick={handleDiarySubmit}
					disabled={activeType !== "diary" || !diaryText.trim() || submitting}
					className="cursor-pointer bg-action text-action-text w-8 h-8 rounded-full flex items-center justify-center hover:bg-action-hover disabled:opacity-10 disabled:cursor-not-allowed transition-all shadow-2xs shrink-0"
					title="Append to Diary"
				>
					<Send aria-hidden="true" className="w-3.5 h-3.5" />
				</button>
			</div>
		</div>
	);
}
