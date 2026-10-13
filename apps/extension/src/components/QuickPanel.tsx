import { SHARED_LIMITS } from "@sitecue/shared";
import {
	ArrowRightLeft,
	Check,
	ChevronDown,
	ChevronRight,
	Copy,
	Eraser,
	ExternalLink,
	Eye,
	FileText,
	Link as LinkIcon,
	Loader2,
	Lock,
	Maximize2,
	Minimize2,
	Pencil,
	Plus,
	Send,
	SquareTerminal,
	Trash2,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import TextareaAutosize from "react-textarea-autosize";
import { useAuth } from "../hooks/useAuth";
import { useAutoIndent } from "../hooks/useAutoIndent";
import { useMarkdownAssist } from "../hooks/useMarkdownAssist";
import { useQuickLinks } from "../hooks/useQuickLinks";
import MarkdownRenderer from "./MarkdownRenderer";
import { Button } from "./ui/button";

interface QuickPanelProps {
	currentDomain: string | null;
	userPlan: "free" | "pro" | "guest";
	onAddNote: (
		content: string,
		scope: "exact" | "domain" | "inbox",
		type: "info" | "alert" | "idea",
	) => Promise<boolean>;
	onAppendDiary: (content: string) => Promise<boolean>;
}

export type QuickPanelTab = "none" | "note" | "command" | "links";
export type QuickNoteViewMode = "edit" | "preview";

export default function QuickPanel({
	currentDomain,
	userPlan,
	onAddNote,
	onAppendDiary,
}: QuickPanelProps) {
	const { authStatus } = useAuth();
	const userId = authStatus.userId || "guest";
	const noteStorageKey = `quick_note_text_${userId}`;
	const codeStorageKey = `quick_code_text_${userId}`;
	const viewModeStorageKey = `quick_note_view_mode_${userId}`;

	const { links, loading, addLink, updateLink, deleteLink } =
		useQuickLinks(currentDomain);
	const [activeSection, setActiveSection] = useState<QuickPanelTab>("none");

	// --- Note State ---
	const [noteText, setNoteText] = useState("");
	const [noteViewMode, setNoteViewMode] = useState<QuickNoteViewMode>("edit");
	const [isNoteMaximized, setIsNoteMaximized] = useState(false);
	const [noteCopied, setNoteCopied] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [isSliding, setIsSliding] = useState(false);
	const noteTextRef = useRef("");
	const noteDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
	const isNoteStorageLoadedRef = useRef(false);

	// --- Command State (Backward compatible with quick_code_text storage) ---
	const [codeText, setCodeText] = useState("");
	const [isCodeMaximized, setIsCodeMaximized] = useState(false);
	const [codeCopied, setCodeCopied] = useState(false);
	const codeTextRef = useRef("");
	const codeDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
	const isCodeStorageLoadedRef = useRef(false);

	// --- Links State ---
	const [isAdding, setIsAdding] = useState(false);
	// biome-ignore lint/suspicious/noExplicitAny: Match existing useQuickLinks type definition
	const [editingLink, setEditingLink] = useState<any | null>(null);
	const [formUrl, setFormUrl] = useState("");
	const [formLabel, setFormLabel] = useState("");
	const [formType, setFormType] = useState<"related" | "env">("related");
	const [linkSubmitting, setLinkSubmitting] = useState(false);

	const isPro = userPlan === "pro";
	const maxNoteLength = isPro
		? SHARED_LIMITS.NOTE_LENGTH.PRO
		: SHARED_LIMITS.NOTE_LENGTH.FREE;
	const maxDiaryLength = isPro
		? SHARED_LIMITS.DIARY_LENGTH.PRO
		: SHARED_LIMITS.DIARY_LENGTH.FREE;

	const isNoteOverLimit = noteText.length > maxNoteLength;
	const isDiaryOverLimit = noteText.length > maxDiaryLength;

	const { onKeyDown: onNoteKeyDown, onPaste: onNotePaste } =
		useMarkdownAssist();
	const { onKeyDown: onCommandKeyDown } = useAutoIndent();

	// 🛡️ Note Storage Flush
	const flushNoteStorage = useCallback(() => {
		if (!isNoteStorageLoadedRef.current) return;
		if (noteDebounceTimerRef.current) {
			clearTimeout(noteDebounceTimerRef.current);
			noteDebounceTimerRef.current = null;
		}
		if (typeof chrome !== "undefined" && chrome.storage?.local) {
			chrome.storage.local.set({ [noteStorageKey]: noteTextRef.current });
		}
	}, [noteStorageKey]);

	// 🛡️ Command Storage Flush
	const flushCodeStorage = useCallback(() => {
		if (!isCodeStorageLoadedRef.current) return;
		if (codeDebounceTimerRef.current) {
			clearTimeout(codeDebounceTimerRef.current);
			codeDebounceTimerRef.current = null;
		}
		if (typeof chrome !== "undefined" && chrome.storage?.local) {
			chrome.storage.local.set({ [codeStorageKey]: codeTextRef.current });
		}
	}, [codeStorageKey]);

	// Note 初期ロード & 復元
	useEffect(() => {
		if (typeof chrome !== "undefined" && chrome.storage?.local) {
			chrome.storage.local.get(noteStorageKey, (result) => {
				const storedText = (result as Record<string, unknown>)[noteStorageKey];
				if (typeof storedText === "string") {
					setNoteText(storedText);
					noteTextRef.current = storedText;
				} else {
					setNoteText("");
					noteTextRef.current = "";
				}
				isNoteStorageLoadedRef.current = true;
			});
			chrome.storage.local.get(viewModeStorageKey, (result) => {
				const storedMode = (result as Record<string, unknown>)[
					viewModeStorageKey
				];
				if (storedMode === "preview" || storedMode === "edit") {
					setNoteViewMode(storedMode);
				}
			});
		}
	}, [noteStorageKey, viewModeStorageKey]);

	// Command 初期ロード & 復元
	useEffect(() => {
		if (typeof chrome !== "undefined" && chrome.storage?.local) {
			chrome.storage.local.get(codeStorageKey, (result) => {
				const storedCode = (result as Record<string, unknown>)[codeStorageKey];
				if (typeof storedCode === "string") {
					setCodeText(storedCode);
					codeTextRef.current = storedCode;
				} else {
					setCodeText("");
					codeTextRef.current = "";
				}
				isCodeStorageLoadedRef.current = true;
			});
		}
	}, [codeStorageKey]);

	// 入力ハンドラ: Note
	const handleNoteTextChange = (val: string) => {
		if (!isNoteStorageLoadedRef.current) return;
		setNoteText(val);
		noteTextRef.current = val;

		if (noteDebounceTimerRef.current) {
			clearTimeout(noteDebounceTimerRef.current);
		}
		noteDebounceTimerRef.current = setTimeout(() => {
			if (typeof chrome !== "undefined" && chrome.storage?.local) {
				chrome.storage.local.set({ [noteStorageKey]: val });
			}
			noteDebounceTimerRef.current = null;
		}, 300);
	};

	// 入力ハンドラ: Command
	const handleCodeTextChange = (val: string) => {
		if (!isCodeStorageLoadedRef.current) return;
		setCodeText(val);
		codeTextRef.current = val;

		if (codeDebounceTimerRef.current) {
			clearTimeout(codeDebounceTimerRef.current);
		}
		codeDebounceTimerRef.current = setTimeout(() => {
			if (typeof chrome !== "undefined" && chrome.storage?.local) {
				chrome.storage.local.set({ [codeStorageKey]: val });
			}
			codeDebounceTimerRef.current = null;
		}, 300);
	};

	// ViewMode 切替と永続化
	const toggleNoteViewMode = () => {
		const nextMode: QuickNoteViewMode =
			noteViewMode === "edit" ? "preview" : "edit";
		setNoteViewMode(nextMode);
		if (typeof chrome !== "undefined" && chrome.storage?.local) {
			chrome.storage.local.set({ [viewModeStorageKey]: nextMode });
		}
	};

	// クリーンアップ & 防壁
	useEffect(() => {
		const handlePageHide = () => {
			flushNoteStorage();
			flushCodeStorage();
		};
		window.addEventListener("pagehide", handlePageHide);
		return () => {
			window.removeEventListener("pagehide", handlePageHide);
			flushNoteStorage();
			flushCodeStorage();
		};
	}, [flushNoteStorage, flushCodeStorage]);

	// Zen Escape
	useEffect(() => {
		if (!isNoteMaximized && !isCodeMaximized) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (e.isComposing) return;
				setIsNoteMaximized(false);
				setIsCodeMaximized(false);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isNoteMaximized, isCodeMaximized]);

	const toggleSection = (section: QuickPanelTab) => {
		setActiveSection((prev) => (prev === section ? "none" : section));
	};

	const handleCopyNote = async () => {
		if (!noteText) return;
		await navigator.clipboard.writeText(noteText);
		setNoteCopied(true);
		setTimeout(() => setNoteCopied(false), 2000);
	};

	const handleCopyCode = async () => {
		if (!codeText) return;
		await navigator.clipboard.writeText(codeText);
		setCodeCopied(true);
		setTimeout(() => setCodeCopied(false), 2000);
	};

	const handleSaveAsNote = async () => {
		if (!noteText.trim() || submitting || isNoteOverLimit) return;
		setSubmitting(true);
		const textToSave = noteText.trim();

		setIsSliding(true);
		await new Promise((resolve) => setTimeout(resolve, 300));

		handleNoteTextChange("");
		setIsSliding(false);

		const success = await onAddNote(textToSave, "inbox", "info");
		setSubmitting(false);

		if (!success) {
			handleNoteTextChange(textToSave);
			toast.error("Failed to send text");
		}
	};

	const handleSaveToDiary = async () => {
		if (!noteText.trim() || submitting || isDiaryOverLimit) return;
		setSubmitting(true);
		const textToSave = noteText.trim();

		setIsSliding(true);
		await new Promise((resolve) => setTimeout(resolve, 300));

		handleNoteTextChange("");
		setIsSliding(false);

		const success = await onAppendDiary(textToSave);
		setSubmitting(false);

		if (!success) {
			handleNoteTextChange(textToSave);
			toast.error("Failed to send text");
		}
	};

	const handleLinkClick = (
		e: React.MouseEvent,
		// biome-ignore lint/suspicious/noExplicitAny: Match existing hook type
		link: any,
	) => {
		if (link.type === "env" && typeof chrome !== "undefined" && chrome.tabs) {
			e.preventDefault();
			chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
				const currentTab = tabs[0];
				if (currentTab?.id && currentTab.url) {
					try {
						const currentUrlObj = new URL(currentTab.url);
						const targetOrigin = new URL(link.target_url).origin;
						const newUrl =
							targetOrigin +
							currentUrlObj.pathname +
							currentUrlObj.search +
							currentUrlObj.hash;
						chrome.tabs.update(currentTab.id, { url: newUrl });
					} catch {
						window.open(link.target_url, "_blank");
					}
				}
			});
		}
	};

	const showFavicons = links.length > 0 && links.length < 5;
	const showNumberBadge = links.length >= 5;

	return (
		<div
			className={`border-b border-base-border bg-base-bg w-full font-sans flex flex-col min-h-0 ${!currentDomain ? "hidden" : ""}`}
		>
			{/* 🚀 3連カプセルヘッダー: [ Note ] [ Command ] --------- [ Links (n) ] */}
			<div className="flex items-center justify-between p-3 py-2 text-xs font-semibold select-none border-b border-base-border/10 shrink-0">
				<div className="flex items-center gap-3">
					{/* Note Tab */}
					<button
						type="button"
						onClick={() => toggleSection("note")}
						title="Scratchpad for temporary notes (Markdown supported)"
						className={`cursor-pointer flex items-center gap-1 transition-colors ${activeSection === "note" ? "text-action" : "text-muted-foreground hover:text-action"}`}
					>
						<FileText aria-hidden="true" className="w-3.5 h-3.5" />
						<span>Note</span>
						{activeSection === "note" ? (
							<ChevronDown aria-hidden="true" className="w-3.5 h-3.5" />
						) : (
							<ChevronRight aria-hidden="true" className="w-3.5 h-3.5" />
						)}
					</button>

					{/* Command Tab */}
					<button
						type="button"
						onClick={() => toggleSection("command")}
						title="Draft and edit multi-line commands or code snippets"
						className={`cursor-pointer flex items-center gap-1 transition-colors ${activeSection === "command" ? "text-action" : "text-muted-foreground hover:text-action"}`}
					>
						<SquareTerminal aria-hidden="true" className="w-3.5 h-3.5" />
						<span>Command</span>
						{activeSection === "command" ? (
							<ChevronDown aria-hidden="true" className="w-3.5 h-3.5" />
						) : (
							<ChevronRight aria-hidden="true" className="w-3.5 h-3.5" />
						)}
					</button>
				</div>

				{/* Quick Links Tab */}
				<button
					type="button"
					onClick={() => toggleSection("links")}
					title="Quick links for this domain"
					className={`cursor-pointer flex items-center gap-2 transition-colors ${activeSection === "links" ? "text-action" : "text-muted-foreground hover:text-action"}`}
				>
					<div className="flex items-center gap-1">
						<LinkIcon aria-hidden="true" className="w-3.5 h-3.5" />
						<span>Links</span>
						{showNumberBadge && (
							<span className="bg-base-surface text-muted-foreground px-1.5 rounded-full text-[10px] border border-base-border font-mono ml-1">
								{links.length}
							</span>
						)}
					</div>
					<div className="flex items-center gap-1">
						{showFavicons &&
							links
								.filter((l) => l.type === "related")
								.slice(0, 4)
								.map((link) => (
									<img
										key={link.id}
										src={`https://www.google.com/s2/favicons?domain=${new URL(link.target_url).hostname}`}
										alt=""
										className="w-3 h-3 rounded-sm shrink-0"
									/>
								))}
						{activeSection === "links" ? (
							<ChevronDown aria-hidden="true" className="w-3.5 h-3.5" />
						) : (
							<ChevronRight aria-hidden="true" className="w-3.5 h-3.5" />
						)}
					</div>
				</button>
			</div>

			{/* --- Note 画面 --- */}
			{activeSection === "note" && (
				<div
					className={
						isNoteMaximized
							? "fixed inset-0 z-50 bg-base-bg p-3 flex flex-col h-full animate-fadeIn"
							: "px-3 py-2.5 flex flex-col gap-2.5 animate-fadeIn bg-base-bg shrink-0"
					}
				>
					{/* ツールバー (3ゾーン分離: 編集操作系 | 状態・表示系 | 送信アクション系) */}
					<div className="flex justify-between items-center gap-2 shrink-0 border-b border-base-border/30 pb-2">
						{/* 左側: 編集操作系 + 中央: 状態・表示系 */}
						<div className="flex items-center">
							{/* [左側: 編集操作系] */}
							<div className="flex items-center gap-1">
								<Button
									disabled={!noteText}
									icon={<Eraser className="size-4" aria-hidden="true" />}
									size="sm"
									variant="ghost"
									onClick={() => handleNoteTextChange("")}
									title="Clear scratchpad"
									className="w-7 h-7 p-0 rounded-full"
								/>
								<Button
									disabled={!noteText}
									icon={
										noteCopied ? (
											<Check
												className="size-4 text-success"
												aria-hidden="true"
											/>
										) : (
											<Copy className="size-4" aria-hidden="true" />
										)
									}
									size="sm"
									variant="ghost"
									onClick={handleCopyNote}
									title="Copy text"
									className="w-7 h-7 p-0 rounded-full"
								/>
							</div>

							{/* (Divider) */}
							<div
								className="h-4 w-px bg-base-border/60 mx-1 shrink-0"
								aria-hidden="true"
							/>

							{/* [中央: 状態・表示系] */}
							<div className="flex items-center gap-1">
								{/* 状態明示型プレビュートグル */}
								<Button
									icon={<Eye className="size-4" aria-hidden="true" />}
									size="sm"
									variant="ghost"
									onClick={toggleNoteViewMode}
									title={
										noteViewMode === "preview"
											? "Exit preview"
											: "Preview Markdown"
									}
									aria-label={
										noteViewMode === "preview"
											? "Exit preview"
											: "Preview Markdown"
									}
									aria-pressed={noteViewMode === "preview"}
									className={`w-7 h-7 p-0 rounded-full ${
										noteViewMode === "preview"
											? "bg-action text-action-text hover:bg-action-hover"
											: ""
									}`}
								/>
								<Button
									icon={
										isNoteMaximized ? (
											<Minimize2 aria-hidden="true" className="size-4" />
										) : (
											<Maximize2 aria-hidden="true" className="size-4" />
										)
									}
									size="sm"
									variant="ghost"
									onClick={() => setIsNoteMaximized((prev) => !prev)}
									title={
										isNoteMaximized ? "Exit full view" : "Maximize Quick Note"
									}
									aria-label={
										isNoteMaximized ? "Exit full view" : "Maximize Quick Note"
									}
									className="w-7 h-7 p-0 rounded-full"
								/>
							</div>
						</div>

						{/* [右側: 送信アクション系] */}
						<div className="flex items-center gap-1.5">
							<Button
								disabled={!noteText.trim() || submitting || isNoteOverLimit}
								icon={
									submitting ? (
										<Loader2
											className="w-3.5 h-3.5 animate-spin"
											aria-hidden="true"
										/>
									) : (
										<Send className="w-3.5 h-3.5" aria-hidden="true" />
									)
								}
								onClick={handleSaveAsNote}
								size="xs"
								variant="outline"
								title={
									isNoteOverLimit
										? `Exceeds Note limit (${maxNoteLength.toLocaleString()} chars)`
										: "Save as Inbox Note"
								}
								className="text-muted-foreground hover:text-action"
							>
								Note
							</Button>
							<Button
								disabled={!noteText.trim() || submitting || isDiaryOverLimit}
								icon={
									submitting ? (
										<Loader2
											className="w-3.5 h-3.5 animate-spin"
											aria-hidden="true"
										/>
									) : (
										<Send className="w-3.5 h-3.5" aria-hidden="true" />
									)
								}
								onClick={handleSaveToDiary}
								size="xs"
								variant="outline"
								title={
									isDiaryOverLimit
										? `Exceeds Diary limit (${maxDiaryLength.toLocaleString()} chars)`
										: "Append to Today's Diary"
								}
								className="text-muted-foreground hover:text-action"
							>
								Diary
							</Button>
						</div>
					</div>

					{/* Note エディタ / プレビュー領域 */}
					<div
						className={
							isNoteMaximized
								? "w-full pt-1 flex-1 min-h-0 overflow-y-auto overscroll-contain"
								: "w-full pt-1 max-h-[30vh] overflow-y-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden overscroll-auto"
						}
					>
						<div
							className={
								isSliding
									? "transition-all duration-300 ease-out translate-x-full opacity-0 pointer-events-none"
									: isNoteMaximized
										? "min-h-full flex flex-col transition-none"
										: "transition-none"
							}
						>
							{noteViewMode === "preview" ? (
								<div className="p-1 min-h-[4rem]">
									{noteText.trim() ? (
										<MarkdownRenderer content={noteText} />
									) : (
										<span className="text-xs text-muted-foreground italic">
											Nothing to preview.
										</span>
									)}
								</div>
							) : (
								<TextareaAutosize
									onChange={(e) => handleNoteTextChange(e.target.value)}
									onBlur={flushNoteStorage}
									value={noteText}
									placeholder="Temporary text scratchpad..."
									className={`w-full resize-none overflow-hidden border-none p-0 text-sm bg-base-bg text-neutral-900 focus:outline-none focus:ring-0 placeholder:text-neutral-400 font-['Hack'] font-mono leading-[1.6] transition-[height] duration-300 ease-out ${
										isNoteMaximized ? "min-h-full" : ""
									}`}
									minRows={isNoteMaximized ? 10 : 3}
									onKeyDown={onNoteKeyDown}
									onPaste={onNotePaste}
								/>
							)}
						</div>
					</div>
				</div>
			)}

			{/* --- Command 専用ターミナル画面 --- */}
			{activeSection === "command" && (
				<div
					className={
						isCodeMaximized
							? "fixed inset-0 z-50 bg-neutral-900 p-3 flex flex-col h-full animate-fadeIn"
							: "px-3 py-2.5 flex flex-col gap-2 animate-fadeIn bg-neutral-900 shrink-0 text-neutral-100"
					}
				>
					{/* 操作バー: [Eraser] [Copy] | (Divider) [Maximize/Minimize] ----------- COMMAND / CODE */}
					<div className="flex justify-between items-center gap-2 shrink-0 border-b border-neutral-800 pb-2">
						<div className="flex items-center">
							<div className="flex items-center gap-1">
								<Button
									disabled={!codeText}
									icon={<Eraser className="size-4" aria-hidden="true" />}
									size="sm"
									variant="ghost"
									onClick={() => handleCodeTextChange("")}
									title="Clear command"
									className="w-7 h-7 p-0 rounded-full text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800"
								/>
								<Button
									disabled={!codeText}
									icon={
										codeCopied ? (
											<Check
												className="size-4 text-note-info"
												aria-hidden="true"
											/>
										) : (
											<Copy className="size-4" aria-hidden="true" />
										)
									}
									size="sm"
									variant="ghost"
									onClick={handleCopyCode}
									title="Copy code"
									className="w-7 h-7 p-0 rounded-full text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800"
								/>
							</div>

							<div
								className="h-4 w-px bg-neutral-800 mx-1 shrink-0"
								aria-hidden="true"
							/>

							<div className="flex items-center gap-1">
								<Button
									icon={
										isCodeMaximized ? (
											<Minimize2 aria-hidden="true" className="size-4" />
										) : (
											<Maximize2 aria-hidden="true" className="size-4" />
										)
									}
									size="sm"
									variant="ghost"
									onClick={() => setIsCodeMaximized((prev) => !prev)}
									title={
										isCodeMaximized ? "Exit full view" : "Maximize Code View"
									}
									aria-label={
										isCodeMaximized ? "Exit full view" : "Maximize Code View"
									}
									className="w-7 h-7 p-0 rounded-full text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800"
								/>
							</div>
						</div>
						<div className="text-[10px] font-['Hack'] font-mono text-neutral-400 uppercase tracking-wider px-1">
							COMMAND / CODE
						</div>
					</div>

					{/* 直接編集ターミナルコンソール (オートインデント有効化) */}
					<div
						className={
							isCodeMaximized
								? "w-full pt-1 flex-1 min-h-0 overflow-y-auto overscroll-contain"
								: "w-full pt-1 max-h-[30vh] overflow-y-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden overscroll-auto"
						}
					>
						<TextareaAutosize
							onChange={(e) => handleCodeTextChange(e.target.value)}
							onBlur={flushCodeStorage}
							value={codeText}
							placeholder="$ docker run -it --rm ..."
							className={`w-full resize-none overflow-hidden border-none p-0 text-xs bg-neutral-900 text-neutral-100 focus:outline-none focus:ring-0 placeholder:text-neutral-500 font-['Hack'] font-mono leading-[1.6] transition-[height] duration-300 ease-out ${
								isCodeMaximized ? "min-h-full" : ""
							}`}
							minRows={isCodeMaximized ? 10 : 3}
							spellCheck={false}
							onKeyDown={onCommandKeyDown}
						/>
					</div>
				</div>
			)}

			{/* --- Links 画面 --- */}
			{activeSection === "links" && (
				<div className="pb-3 px-3 animate-fadeIn bg-base-bg overflow-y-auto max-h-[40vh] scrollbar-none shrink-0">
					<div className="space-y-1">
						{loading ? (
							<div className="flex justify-center py-2">
								<Loader2
									aria-hidden="true"
									className="w-4 h-4 animate-spin text-muted-foreground"
								/>
							</div>
						) : links.length === 0 ? (
							!isAdding && (
								<div className="text-center text-muted-foreground text-xs py-2 italic">
									No links added yet.
								</div>
							)
						) : (
							links.map((link) => {
								const isIncoming = link.domain !== currentDomain;
								return (
									<div
										key={link.id}
										className="group flex items-center justify-between p-1 hover:bg-base-bg rounded-xl transition-colors text-sm"
									>
										<a
											href={link.target_url}
											target={link.type === "related" ? "_blank" : undefined}
											rel={
												link.type === "related"
													? "noopener noreferrer"
													: undefined
											}
											onClick={(e) => handleLinkClick(e, link)}
											className="flex items-center gap-2 flex-1 min-w-0"
											title={link.target_url}
										>
											{link.type === "related" ? (
												<img
													src={`https://www.google.com/s2/favicons?domain=${new URL(link.target_url).hostname}`}
													alt=""
													className="w-4 h-4 rounded-sm shrink-0"
												/>
											) : (
												<ArrowRightLeft
													aria-hidden="true"
													className="w-4 h-4 text-action shrink-0"
												/>
											)}
											<span className="truncate text-action">{link.label}</span>
											{link.type === "related" && (
												<ExternalLink
													aria-hidden="true"
													className="w-3 h-3 text-muted-foreground shrink-0"
												/>
											)}
											{link.type === "env" && (
												<span className="flex items-center gap-0.5 text-[10px] text-muted-foreground ml-1 shrink-0 border border-base-border px-1.5 rounded-full bg-base-surface">
													ENV
													{isIncoming && (
														<Lock aria-hidden="true" className="w-3 h-3" />
													)}
												</span>
											)}
										</a>
										{!isIncoming && (
											<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
												<button
													type="button"
													onClick={() => {
														setEditingLink(link);
														setFormUrl(link.target_url);
														setFormLabel(link.label);
														setFormType(link.type);
														setIsAdding(true);
													}}
													className="cursor-pointer p-1 text-muted-foreground hover:text-action hover:bg-base-surface rounded-full transition-colors"
												>
													<Pencil aria-hidden="true" className="w-3.5 h-3.5" />
												</button>
												<button
													type="button"
													onClick={() => deleteLink(link.id)}
													className="cursor-pointer p-1 text-muted-foreground hover:text-note-alert hover:bg-note-alert/10 rounded-full transition-colors"
												>
													<Trash2 aria-hidden="true" className="w-3.5 h-3.5" />
												</button>
											</div>
										)}
									</div>
								);
							})
						)}

						{isAdding ? (
							<form
								onSubmit={async (e) => {
									e.preventDefault();
									if (!formUrl.trim() || !formLabel.trim()) return;
									setLinkSubmitting(true);
									if (editingLink) {
										await updateLink(editingLink.id, {
											label: formLabel,
											target_url: formUrl,
											type: formType,
										});
									} else {
										await addLink({
											label: formLabel,
											target_url: formUrl,
											type: formType,
										});
									}
									setIsAdding(false);
									setEditingLink(null);
									setFormUrl("");
									setFormLabel("");
									setLinkSubmitting(false);
								}}
								className="mt-2 text-xs border border-base-border rounded-2xl p-3 bg-base-bg flex flex-col gap-2.5 shadow-2xs"
							>
								<input
									// biome-ignore lint/a11y/noAutofocus: intentional UX
									autoFocus
									type="text"
									required
									placeholder="URL"
									value={formUrl}
									onChange={(e) => setFormUrl(e.target.value)}
									className="w-full p-2 px-3.5 border border-base-border rounded-full bg-base-surface text-action text-xs focus:outline-none focus:ring-1 focus:ring-action/30 placeholder:text-neutral-400"
								/>
								<input
									type="text"
									required
									placeholder="Label"
									value={formLabel}
									onChange={(e) => setFormLabel(e.target.value)}
									className="w-full p-2 px-3.5 border border-base-border rounded-full bg-base-surface text-action text-xs focus:outline-none focus:ring-1 focus:ring-action/30 placeholder:text-neutral-400"
								/>
								<div className="flex gap-3 px-1 text-muted-foreground">
									<label className="flex items-center gap-1.5 cursor-pointer select-none">
										<input
											type="radio"
											checked={formType === "related"}
											onChange={() => setFormType("related")}
											className="accent-action"
										/>
										<span>Related</span>
									</label>
									<label className="flex items-center gap-1.5 cursor-pointer select-none">
										<input
											type="radio"
											checked={formType === "env"}
											onChange={() => setFormType("env")}
											className="accent-action"
										/>
										<span>Env Switch</span>
									</label>
								</div>
								<div className="flex justify-end gap-1.5 pt-1.5 border-t border-base-border/30">
									<Button
										icon={<X aria-hidden="true" className="w-3.5 h-3.5" />}
										size="xs"
										variant="ghost"
										onClick={() => {
											setIsAdding(false);
											setEditingLink(null);
										}}
									>
										Cancel
									</Button>
									<Button
										disabled={linkSubmitting}
										icon={
											linkSubmitting ? (
												<Loader2
													aria-hidden="true"
													className="w-3.5 h-3.5 animate-spin"
												/>
											) : (
												<Check aria-hidden="true" className="w-3.5 h-3.5" />
											)
										}
										size="xs"
										variant="default"
										type="submit"
									>
										{editingLink ? "Update" : "Add"}
									</Button>
								</div>
							</form>
						) : (
							<button
								type="button"
								onClick={() => {
									setEditingLink(null);
									setFormUrl("");
									setFormLabel("");
									setFormType("related");
									setIsAdding(true);
								}}
								className="cursor-pointer w-full text-left p-2 px-3 text-xs text-muted-foreground hover:text-action hover:bg-base-bg rounded-full flex items-center gap-1 transition-colors border border-dashed border-base-border/40 mt-1"
							>
								<Plus aria-hidden="true" className="w-3.5 h-3.5" />
								<span>Add Link</span>
							</button>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
