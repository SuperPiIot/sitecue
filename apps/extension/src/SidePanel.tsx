import {
	appendDiaryLog,
	fetchDiaryByDate,
	getScopeUrls,
	SHARED_LIMITS,
} from "@sitecue/shared";
import {
	QueryClient,
	QueryClientProvider,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	Check,
	Copy,
	Loader2,
	Maximize2,
	Minimize2,
	Plus,
	X,
} from "lucide-react";
import {
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Toaster, toast } from "react-hot-toast";
import DiaryView from "./components/DiaryView";
import FilterBar from "./components/FilterBar";
import Header from "./components/Header";
import LoginScreen from "./components/LoginScreen";
import NoteInput from "./components/NoteInput";
import NoteList from "./components/NoteList";
import NoteSkeleton from "./components/NoteSkeleton";
import QuickPanel from "./components/QuickPanel";
import type { AuthStatus } from "./hooks/useAuth";
import { useAuth } from "./hooks/useAuth";
import { useCurrentTab } from "./hooks/useCurrentTab";
import type { NoteScope, NoteType } from "./hooks/useNotes";
import { useNotes } from "./hooks/useNotes";
import { useUserStats } from "./hooks/useUserStats";

const MAX_FREE_NOTES = 500;
const SKELETON_HOLD_MS = 300;
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: false,
		},
	},
});

export default function SidePanel() {
	const {
		session,
		authLoading,
		authError,
		sessionLoading,
		handleLogout,
		handleSocialLogin,
		authStatus,
		handleGuestLogin,
		handleGuestLogout,
	} = useAuth();

	if (sessionLoading && authStatus.mode !== "guest") {
		return (
			<div className="w-full h-screen bg-base-surface flex flex-col items-center justify-center font-sans">
				<Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!session && authStatus.mode !== "guest") {
		return (
			<LoginScreen
				authError={authError}
				authLoading={authLoading}
				handleSocialLogin={handleSocialLogin}
				onGuestLogin={handleGuestLogin}
			/>
		);
	}

	return (
		<QueryClientProvider client={queryClient}>
			<NotesUI
				authStatus={authStatus}
				onLogout={
					authStatus.mode === "guest" ? handleGuestLogout : handleLogout
				}
			/>
		</QueryClientProvider>
	);
}

function NotesUI({
	authStatus,
	onLogout,
}: {
	authStatus: AuthStatus;
	onLogout: () => void;
}) {
	const session =
		authStatus.mode === "authenticated" ? authStatus.session : null;
	const { currentFullUrl, url, title } = useCurrentTab();
	const { userPlan: dbUserPlan, userStatsLoading: dbUserStatsLoading } =
		useUserStats(session);

	const isGuest = authStatus.mode === "guest";
	const userPlan = isGuest ? "guest" : dbUserPlan;
	const userStatsLoading = isGuest ? false : dbUserStatsLoading;

	// 🔍 フィルタリング用ステート
	const [filterType, setFilterType] = useState<
		"all" | "info" | "alert" | "idea"
	>("all");
	const [showResolved, setShowResolved] = useState(false);
	const [viewScope, setViewScope] = useState<"exact" | "domain" | "inbox">(
		"exact",
	);

	const [isScopeSwitching, setIsScopeSwitching] = useState(false);
	// 💡 初期値を空 Set とし、初回起動（Pageタブ Cold Start）でも確実にスケルトンを表示させる
	const visitedScopesRef = useRef<Set<"exact" | "domain" | "inbox">>(new Set());
	const [searchQuery, setSearchQuery] = useState("");

	const [selectedTag, setSelectedTag] = useState<string | null>(null);

	// 💡 全フィルター状態を1つのオブジェクトに集約
	const rawFilterState = useMemo(
		() => ({
			viewScope,
			filterType,
			searchQuery,
			selectedTag,
			showResolved,
		}),
		[viewScope, filterType, searchQuery, selectedTag, showResolved],
	);

	// 💡 React Concurrent Rendering で全フィルター操作と重いリスト描画を一括非同期分離
	const deferredFilterState = useDeferredValue(rawFilterState);

	const [isNotesMaximized, setIsNotesMaximized] = useState(false);
	const [isInputModeOpen, setIsInputModeOpen] = useState(false);
	const listContainerRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// State
	const [isDiaryOpen, setIsDiaryOpen] = useState(false);
	const [selectedDiaryDate, setSelectedDiaryDate] = useState(() => {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
	});
	const [isEditingDiary, setIsEditingDiary] = useState(false);
	const [editDiaryContent, setEditDiaryContent] = useState("");
	const [editDiaryTopics, setEditDiaryTopics] = useState<string[]>([]);
	const diaryDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);

	const queryClient = useQueryClient();

	// selectedDiaryDate (形式: "2026-07-08") からクエリパラメータを解決
	const [yearStr, monthStr] = selectedDiaryDate.split("-");
	const basecampArchiveUrl = `https://app.sitecue.app/notes?view=diaries&year=${yearStr}&month=${monthStr}`;

	// Fetch diary logs via fetchDiaryByDate from @sitecue/shared
	const { data: diaryData, isLoading: isDiaryLoading } = useQuery({
		queryKey: [
			"diary",
			selectedDiaryDate,
			authStatus.mode === "authenticated"
				? authStatus.session?.user.id
				: "guest",
		],
		queryFn: async () => {
			if (authStatus.mode === "guest") {
				const storedText =
					localStorage.getItem(`diary-${selectedDiaryDate}`) || "";
				const storedTopicsJson = localStorage.getItem(
					`diary-topics-${selectedDiaryDate}`,
				);
				const storedTopics = storedTopicsJson
					? JSON.parse(storedTopicsJson)
					: [];
				return { content: storedText, topics: storedTopics };
			}
			const supabaseClient = (await import("./supabaseClient")).supabase;
			return fetchDiaryByDate(
				supabaseClient,
				authStatus.session?.user.id ?? "",
				selectedDiaryDate,
			);
		},
		enabled: isDiaryOpen,
	});

	// Append diary mutation via appendDiaryLog from @sitecue/shared
	const appendDiaryMutation = useMutation({
		mutationFn: async (text: string) => {
			const now = new Date();
			const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
			if (authStatus.mode === "guest") {
				const existing = localStorage.getItem(`diary-${todayStr}`) || "";
				const timestamp = `[${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}]`;
				const newContent = existing
					? `${existing}\n\n${timestamp} ${text}`
					: `${timestamp} ${text}`;
				localStorage.setItem(`diary-${todayStr}`, newContent);
				return { content: newContent };
			}
			const supabaseClient = (await import("./supabaseClient")).supabase;
			return appendDiaryLog(
				supabaseClient,
				authStatus.session?.user.id ?? "",
				todayStr,
				text,
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["diary"] });
		},
	});

	// Update diary content and topics mutation
	const updateDiaryMutation = useMutation({
		mutationFn: async ({
			text,
			topics,
		}: {
			text: string;
			topics: string[];
		}) => {
			if (authStatus.mode === "guest") {
				localStorage.setItem(`diary-${selectedDiaryDate}`, text);
				localStorage.setItem(
					`diary-topics-${selectedDiaryDate}`,
					JSON.stringify(topics),
				);
				return { content: text, topics };
			}
			const supabaseClient = (await import("./supabaseClient")).supabase;
			const { updateDiaryContent } = await import("@sitecue/shared");
			return updateDiaryContent(
				supabaseClient,
				authStatus.session?.user.id ?? "",
				selectedDiaryDate,
				text,
				topics,
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["diary"] });
		},
	});

	// 1. ミリ秒レベルの一時保存
	useEffect(() => {
		if (!isEditingDiary) return;
		if (typeof chrome !== "undefined" && chrome.storage?.local) {
			const key = `diary-temp-${selectedDiaryDate}`;
			chrome.storage.local.set({
				[key]: {
					content: editDiaryContent,
					topics: editDiaryTopics,
					lastSavedAt: Date.now(),
				},
			});
		}
	}, [editDiaryContent, editDiaryTopics, isEditingDiary, selectedDiaryDate]);

	// 2. 「3秒」デバウンスでのサイレントクラウド本保存
	useEffect(() => {
		if (!isEditingDiary) return;

		const timer = setTimeout(async () => {
			const isContentUnchanged =
				editDiaryContent === (diaryData?.content ?? "");
			const isTopicsUnchanged =
				JSON.stringify(editDiaryTopics) ===
				JSON.stringify(diaryData?.topics ?? []);
			if (isContentUnchanged && isTopicsUnchanged) return;

			try {
				await updateDiaryMutation.mutateAsync({
					text: editDiaryContent,
					topics: editDiaryTopics,
				});
				// 本保存が成功したら一時バッファを削除
				if (typeof chrome !== "undefined" && chrome.storage?.local) {
					await chrome.storage.local.remove(`diary-temp-${selectedDiaryDate}`);
				}
			} catch (_err) {
				// ネットワークオフライン等の場合は一時バッファにデータを保持し続ける
			}
		}, 3000);

		diaryDebounceTimerRef.current = timer;

		return () => {
			clearTimeout(timer);
			if (diaryDebounceTimerRef.current === timer) {
				diaryDebounceTimerRef.current = null;
			}
		};
	}, [
		editDiaryContent,
		editDiaryTopics,
		isEditingDiary,
		diaryData,
		selectedDiaryDate,
		updateDiaryMutation.mutateAsync,
	]);

	// 3. 起動時・日付変更時の自動復元・同期マージ
	useEffect(() => {
		const isPro = userPlan === "pro";
		const maxDiaryLength = isPro
			? SHARED_LIMITS.DIARY_LENGTH.PRO
			: SHARED_LIMITS.DIARY_LENGTH.FREE;

		const checkAndRestore = async () => {
			if (typeof chrome === "undefined" || !chrome.storage?.local) return;
			const key = `diary-temp-${selectedDiaryDate}`;
			const result = await chrome.storage.local.get(key);
			const temp = result[key] as
				| { content: string; topics: string[]; lastSavedAt: number }
				| undefined;
			if (temp && typeof temp.content === "string" && temp.content.trim()) {
				// 🛡️ キャッシュが上限を超えている場合は汚染キャッシュとみなし即座に削除・拒否
				if (temp.content.length > maxDiaryLength) {
					await chrome.storage.local.remove(key);
					setEditDiaryContent(diaryData?.content ?? "");
					setEditDiaryTopics(diaryData?.topics ?? []);
					return;
				}

				// 一時バッファを発見した場合、即メモリにロード（In-Memory First）
				setEditDiaryContent(temp.content);
				setEditDiaryTopics(temp.topics);
				setIsEditingDiary(true);

				// バックグラウンドでサイレント同期
				try {
					await updateDiaryMutation.mutateAsync({
						text: temp.content,
						topics: temp.topics,
					});
					await chrome.storage.local.remove(key);
					setIsEditingDiary(false); // 同期完了したら閲覧モードへ
					queryClient.invalidateQueries({
						queryKey: ["diary", selectedDiaryDate],
					});
				} catch (_err) {
					// 同期に失敗した場合は一時バッファを維持したまま編集状態にする
				}
			}
		};
		checkAndRestore();
	}, [
		selectedDiaryDate,
		updateDiaryMutation.mutateAsync,
		queryClient,
		userPlan,
		diaryData?.content,
		diaryData?.topics,
	]);

	const handleAppendDiary = async (content: string) => {
		try {
			await appendDiaryMutation.mutateAsync(content);
			return true;
		} catch (_err) {
			return false;
		}
	};

	const handleSaveDiaryEdit = async () => {
		// 1. デバウンスタイマーが存在する場合は即時破棄
		if (diaryDebounceTimerRef.current) {
			clearTimeout(diaryDebounceTimerRef.current);
			diaryDebounceTimerRef.current = null;
		}

		const isPro = userPlan === "pro";
		const maxDiaryLength = isPro
			? SHARED_LIMITS.DIARY_LENGTH.PRO
			: SHARED_LIMITS.DIARY_LENGTH.FREE;

		// 2. 事前バリデーション（文字数上限チェック）
		if (editDiaryContent.length > maxDiaryLength) {
			toast.error(
				`Diary content exceeds limit (${maxDiaryLength.toLocaleString()} chars). Reverted.`,
			);
			if (typeof chrome !== "undefined" && chrome.storage?.local) {
				await chrome.storage.local.remove(`diary-temp-${selectedDiaryDate}`);
			}
			setEditDiaryContent(diaryData?.content ?? "");
			setEditDiaryTopics(diaryData?.topics ?? []);
			setIsEditingDiary(false);
			return;
		}

		// 3. 無変更ガード（完全一致時はスキップ）
		if (
			editDiaryContent === (diaryData?.content ?? "") &&
			JSON.stringify(editDiaryTopics) ===
				JSON.stringify(diaryData?.topics ?? [])
		) {
			if (typeof chrome !== "undefined" && chrome.storage?.local) {
				await chrome.storage.local.remove(`diary-temp-${selectedDiaryDate}`);
			}
			setIsEditingDiary(false);
			return;
		}

		// 🌟 4. 楽観的UI（Optimistic UI）化: 通信完了を待たずに 0ms で閲覧モード復帰 ＆ キャッシュ即時更新
		const previousData = diaryData;
		const optimisticData = {
			content: editDiaryContent,
			topics: editDiaryTopics,
		};

		const queryKey = [
			"diary",
			selectedDiaryDate,
			authStatus.mode === "authenticated"
				? authStatus.session?.user.id
				: "guest",
		];

		// ① キャッシュを0msで先行更新（Optimistic Update）
		queryClient.setQueryData(queryKey, optimisticData);

		// ② 閲覧モードへ0msで即時復帰（引っかかりを100%パージ）
		setIsEditingDiary(false);

		// ③ 一時ローカルキャッシュのクリア
		if (typeof chrome !== "undefined" && chrome.storage?.local) {
			await chrome.storage.local.remove(`diary-temp-${selectedDiaryDate}`);
		}

		// ④ バックグラウンドでの非同期通信実行
		try {
			await updateDiaryMutation.mutateAsync({
				text: editDiaryContent,
				topics: editDiaryTopics,
			});
		} catch (_err) {
			toast.error("Failed to save diary. Reverted.");
			// 通信失敗時のみ以前のデータへロールバック
			queryClient.setQueryData(queryKey, previousData);
			setEditDiaryContent(previousData?.content ?? "");
			setEditDiaryTopics(previousData?.topics ?? []);
		}
	};

	const handleStartEdit = () => {
		setEditDiaryContent(diaryData?.content || "");
		setEditDiaryTopics(diaryData?.topics || []);
		setIsEditingDiary(true);
	};

	const {
		notes,
		loading,
		isInboxLoading,
		addNote: originalAddNote,
		updateNote,
		deleteNote,
		toggleResolved,
		toggleFavorite,
		togglePinned,
		updateNoteOrder,
		toggleNoteExpansion,
	} = useNotes(authStatus, currentFullUrl, () => {}, viewScope);

	// 🔍 フィルタリングロジックの集約 (SSOT) を useMemo で要塞化
	const scopeUrls = currentFullUrl
		? getScopeUrls(currentFullUrl)
		: { domain: "", exact: "" };

	const isContentUnchanged = editDiaryContent === (diaryData?.content ?? "");
	const isTopicsUnchanged =
		JSON.stringify(editDiaryTopics) === JSON.stringify(diaryData?.topics ?? []);
	const hasDiaryChanges =
		isEditingDiary && (!isContentUnchanged || !isTopicsUnchanged);

	const checkLeaveGuard = useCallback((): boolean => {
		if (hasDiaryChanges) {
			return confirm(
				"You have unsaved diary changes. Are you sure you want to discard them?",
			);
		}
		return true;
	}, [hasDiaryChanges]);

	// 💡 スコープごとの対象ノート件数を事前計算（0件スケルトンスキップ用）
	const getScopeNoteCount = useCallback(
		(targetScope: "exact" | "domain" | "inbox") => {
			return notes.filter((n) => {
				if (targetScope === "inbox") return n.scope === "inbox";
				if (targetScope === "domain")
					return n.scope === "domain" && n.url_pattern === scopeUrls.domain;
				return n.scope === "exact" && n.url_pattern === scopeUrls.exact;
			}).length;
		},
		[notes, scopeUrls.domain, scopeUrls.exact],
	);

	const handleViewScopeChange = useCallback(
		(scope: "exact" | "domain" | "inbox") => {
			if (!checkLeaveGuard()) return;

			// 1. タブの選択Stateは 0ms 最優先で即座に更新
			setViewScope(scope);

			const isVisited = visitedScopesRef.current.has(scope);
			const targetCount = getScopeNoteCount(scope);

			// 💡 Inbox未訪問（Cold State）時は手元件数判定をバイパスして確実に300msスケルトンを起動
			const shouldShowSkeleton =
				!isVisited && (scope === "inbox" || targetCount > 0);

			if (shouldShowSkeleton) {
				visitedScopesRef.current.add(scope);
				setIsScopeSwitching(true);
				setTimeout(() => {
					setIsScopeSwitching(false);
				}, SKELETON_HOLD_MS);
			} else {
				visitedScopesRef.current.add(scope);
			}
		},
		[checkLeaveGuard, getScopeNoteCount],
	);

	const handleCloseDiary = () => {
		if (!checkLeaveGuard()) return;
		setIsDiaryOpen(false);
	};

	// 📋 一括コピー用のステートとロジック
	const [isCopied, setIsCopied] = useState(false);
	const [isCopyMenuOpen, setIsCopyMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const copyToClipboard = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setIsCopied(true);
			setTimeout(() => setIsCopied(false), 2000);
		} catch {
			// clipboard write failed silently
		}
	};

	const handleCopyText = async () => {
		const text = finalFilteredNotes.map((n) => n.content ?? "").join("\n\n");
		await copyToClipboard(text);
		setIsCopyMenuOpen(false);
	};

	const handleCopyJson = async () => {
		const json = finalFilteredNotes.map((n) => ({
			type: n.note_type || "info",
			content: n.content,
		}));
		await copyToClipboard(JSON.stringify(json, null, 2));
		setIsCopyMenuOpen(false);
	};

	// Close search, modals, and exit maximized mode when pressing Escape (LIFO)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (e.isComposing) return;

				// 1. コピーメニュー展開中ならメニューを閉じる
				if (isCopyMenuOpen) {
					setIsCopyMenuOpen(false);
					return;
				}

				// 2. 新規ノート入力モーダル展開中ならモーダルを閉じる
				if (isInputModeOpen) {
					setIsInputModeOpen(false);
					return;
				}

				// 3. input/textarea にフォーカス中、または一覧内でノート編集中（textareaが存在）なら最大化解除をブロック
				const isEditingInList = Boolean(
					listContainerRef.current?.querySelector("textarea"),
				);
				if (
					document.activeElement instanceof HTMLInputElement ||
					document.activeElement instanceof HTMLTextAreaElement ||
					isEditingInList
				) {
					if (document.activeElement instanceof HTMLElement) {
						document.activeElement.blur();
					}
					return;
				}

				// 4. ノート一覧最大化中なら通常表示に復帰（フォーカスも安全に解放）
				if (isNotesMaximized) {
					if (document.activeElement instanceof HTMLElement) {
						document.activeElement.blur();
					}
					setIsNotesMaximized(false);
					return;
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isCopyMenuOpen, isInputModeOpen, isNotesMaximized]);

	// Close menu when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setIsCopyMenuOpen(false);
			}
		};
		if (isCopyMenuOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isCopyMenuOpen]);

	// 💡 isNotesLoading に Inbox オンデマンド待機の防壁を追加
	const isInboxInitialLoading =
		viewScope === "inbox" &&
		isInboxLoading &&
		notes.filter((n) => n.scope === "inbox").length === 0;

	const isNotesLoading =
		(loading && notes.length === 0) ||
		isScopeSwitching ||
		isInboxInitialLoading;

	const handleUpdateNoteOrder = useCallback(
		(id: string, newOrder: number) => {
			return updateNoteOrder(id, newOrder);
		},
		[updateNoteOrder],
	);

	const totalNoteCount = notes.filter((n) => n.scope !== "inbox").length;

	// スクロールバック付きのラッパー関数
	const handleAddNote = async (
		content: string,
		scope: NoteScope,
		type: NoteType,
	) => {
		const success = await originalAddNote(content, scope, type);
		if (success) {
			// 新規ノート追加時、背後のノートリストを最上部へ自动でスクロールバック
			setTimeout(() => {
				if (listContainerRef.current) {
					listContainerRef.current.scrollTo({
						top: 0,
						behavior: "smooth",
					});
				}
			}, 100);
		}
		return success;
	};

	// 🔍 単一の直感的フィルタリングロジックへ一本化 (SSOT)
	const filteredNotesForTags = useMemo(() => {
		return notes.filter((n) => {
			// 🌟 お気に入りの場合はタブスコープ制限をバイパスして常時表示を許可
			if (!n.is_favorite) {
				const isCurrentScope =
					(deferredFilterState.viewScope === "inbox" && n.scope === "inbox") ||
					(deferredFilterState.viewScope === "domain" &&
						n.scope === "domain" &&
						n.url_pattern === scopeUrls.domain) ||
					(deferredFilterState.viewScope === "exact" &&
						n.scope === "exact" &&
						n.url_pattern === scopeUrls.exact);

				if (!isCurrentScope) {
					return false;
				}

				if (deferredFilterState.viewScope === "inbox" && n.scope !== "inbox")
					return false;
				if (deferredFilterState.viewScope !== "inbox" && n.scope === "inbox")
					return false;
				if (n.scope !== deferredFilterState.viewScope) return false;
			}

			if (
				deferredFilterState.filterType !== "all" &&
				(n.note_type || "info") !== deferredFilterState.filterType
			) {
				return false;
			}

			if (!deferredFilterState.showResolved && n.is_resolved) {
				return false;
			}

			if (deferredFilterState.searchQuery) {
				const searchLower = deferredFilterState.searchQuery.toLowerCase();
				const matchesContent = n.content?.toLowerCase().includes(searchLower);
				const matchesTags = n.tags?.some((tag) =>
					tag.toLowerCase().includes(searchLower),
				);
				const matchesUrl = n.url_pattern?.toLowerCase().includes(searchLower);

				if (!matchesContent && !matchesTags && !matchesUrl) {
					return false;
				}
			}

			return true;
		});
	}, [notes, deferredFilterState, scopeUrls.domain, scopeUrls.exact]);

	const availableTags = useMemo(() => {
		return Array.from(
			new Set(
				filteredNotesForTags.flatMap(
					(n) => (n as { tags?: string[] }).tags || [],
				),
			),
		).sort();
	}, [filteredNotesForTags]);

	const finalFilteredNotes = useMemo(() => {
		return filteredNotesForTags.filter((n) => {
			const noteTags = (n as { tags?: string[] }).tags || [];
			if (
				deferredFilterState.selectedTag &&
				!noteTags.includes(deferredFilterState.selectedTag)
			) {
				return false;
			}
			return true;
		});
	}, [filteredNotesForTags, deferredFilterState.selectedTag]);

	return (
		<div className="w-full h-screen bg-base-surface grid grid-rows-[auto_auto_auto_auto_1fr] relative font-sans">
			<Toaster
				position="top-center"
				toastOptions={{
					style: {
						fontSize: "12px",
						padding: "8px 12px",
						borderRadius: "8px",
						background: "#262626", // action
						color: "#ffffff", // action-text
					},
				}}
			/>
			<div className={isNotesMaximized ? "hidden" : "contents"}>
				<Header
					url={url}
					title={title}
					domain={currentFullUrl ? getScopeUrls(currentFullUrl).domain : ""}
					session={session}
					onLogout={onLogout}
					authStatus={authStatus}
					onDiaryClick={() => {
						setIsDiaryOpen(true);
						setIsEditingDiary(false);
					}}
				/>

				<QuickPanel
					currentDomain={
						currentFullUrl ? getScopeUrls(currentFullUrl).domain : null
					}
					onAddNote={handleAddNote}
					onAppendDiary={handleAppendDiary}
					userPlan={userPlan}
				/>

				<FilterBar
					filterType={filterType}
					setFilterType={setFilterType}
					showResolved={showResolved}
					setShowResolved={setShowResolved}
					viewScope={viewScope}
					setViewScope={handleViewScopeChange}
					searchQuery={searchQuery}
					setSearchQuery={setSearchQuery}
					selectedTag={selectedTag}
					setSelectedTag={setSelectedTag}
					availableTags={availableTags}
				/>
			</div>

			{/* 🚀 等幅3カラム中央集権型アクションバー (グレー背景を白背景 bg-base-bg へ融和) */}
			<div className="grid grid-cols-3 items-center px-4 py-2 bg-base-bg shrink-0 border-b border-base-border/40 shadow-xs">
				{/* 左カラム：ノート一覧最大化ボタン */}
				<div className="flex justify-start">
					<button
						type="button"
						onClick={() => setIsNotesMaximized((prev) => !prev)}
						className="cursor-pointer flex items-center justify-center rounded-full transition-colors shrink-0 size-7 text-muted-foreground hover:text-action bg-base-surface hover:bg-base-border focus:outline-none focus-visible:outline-none"
						title={isNotesMaximized ? "Exit full view" : "Maximize notes view"}
						aria-label={
							isNotesMaximized ? "Exit full view" : "Maximize notes view"
						}
					>
						{isNotesMaximized ? (
							<Minimize2 aria-hidden="true" className="w-3.5 h-3.5" />
						) : (
							<Maximize2 aria-hidden="true" className="w-3.5 h-3.5" />
						)}
					</button>
				</div>

				{/* 一角カラム：「＋」ボタンを物理的中心に完全ロック */}
				<div className="flex justify-center">
					<button
						type="button"
						onClick={() => {
							setIsInputModeOpen(true);
							setTimeout(() => textareaRef.current?.focus(), 50);
						}}
						className="cursor-pointer w-9 h-9 rounded-full bg-action text-action-text shadow-md hover:bg-action-hover transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center border border-action-hover/10"
						title="Create new note"
					>
						<Plus aria-hidden="true" className="w-4 h-4" />
					</button>
				</div>

				{/* 右カラム：移設された一括コピーボタン (ドロップダウン) */}
				<div className="flex justify-end relative" ref={menuRef}>
					<button
						type="button"
						onClick={() => setIsCopyMenuOpen(!isCopyMenuOpen)}
						className={`cursor-pointer flex items-center justify-center rounded-full transition-colors shrink-0 size-7 ${
							isCopied
								? "text-note-info bg-note-info/10"
								: isCopyMenuOpen
									? "text-action bg-base-border"
									: "text-muted-foreground bg-base-surface hover:text-action hover:bg-base-border"
						}`}
						title={isCopied ? "Copied!" : "Copy options"}
						aria-label={isCopied ? "Copied!" : "Open copy options menu"}
					>
						{isCopied ? (
							<Check className="w-3.5 h-3.5" />
						) : (
							<Copy className="w-3.5 h-3.5" />
						)}
					</button>

					{isCopyMenuOpen && (
						<div className="absolute right-0 top-full mt-1 bg-base-surface border border-base-border rounded shadow-md z-40 py-1 min-w-[120px]">
							<button
								type="button"
								onClick={handleCopyText}
								className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-base-bg transition-colors"
							>
								Copy as Text
							</button>
							<button
								type="button"
								onClick={handleCopyJson}
								className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-base-bg transition-colors"
							>
								Copy as JSON
							</button>
						</div>
					)}
				</div>
			</div>

			<div
				ref={listContainerRef}
				className="overflow-y-auto px-4 pb-4 pt-0 relative"
			>
				{/* 💡 スティッキー吸着時の上部隙間をゼロにしつつ、初期状態の窮屈さを防ぐ空気感スペーサー */}
				<div className="h-2 shrink-0" aria-hidden="true" />

				{isNotesLoading ? (
					<div className="space-y-3 pt-2">
						{["skel-1", "skel-2", "skel-3"].map((key) => (
							<NoteSkeleton key={key} />
						))}
					</div>
				) : (
					<NoteList
						scope={deferredFilterState.viewScope}
						notes={finalFilteredNotes}
						loading={loading}
						currentFullUrl={currentFullUrl}
						onUpdate={updateNote}
						onDelete={deleteNote}
						onToggleResolved={toggleResolved}
						onToggleFavorite={toggleFavorite}
						onTogglePinned={togglePinned}
						onUpdateNoteOrder={handleUpdateNoteOrder}
						onToggleExpansion={toggleNoteExpansion}
						showResolved={deferredFilterState.showResolved}
					/>
				)}
			</div>

			{isInputModeOpen && (
				<>
					{/* 背景の遮断レイヤー（領域外クリックで閉じる） */}
					<button
						type="button"
						className="absolute inset-0 bg-black/20 backdrop-blur-[1px] z-40 transition-opacity duration-200 cursor-default"
						onClick={() => setIsInputModeOpen(false)}
						aria-label="Close input overlay"
					/>
					<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] max-w-sm z-50 animate-in fade-in zoom-in-95 duration-200">
						{userStatsLoading ? (
							<div className="p-4 bg-base-surface border border-base-border/50 rounded-2xl shadow-2xl flex items-center justify-center">
								<Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
							</div>
						) : (
							<>
								{/* 🚨 ゲスト用 Note Limit 警告アラート（90%にあたる45件以上で露出） */}
								{isGuest && totalNoteCount >= 45 && (
									<div className="text-[11px] text-note-alert bg-note-alert/10 border border-note-alert/20 p-2.5 rounded-xl mb-2 text-center font-medium shadow-sm animate-in fade-in duration-200">
										Note storage limit approaching ({totalNoteCount}/50).
										<br />
										Please sign in to enjoy unlimited cloud sync.
									</div>
								)}
								<NoteInput
									userPlan={userPlan}
									totalNoteCount={totalNoteCount}
									maxFreeNotes={isGuest ? 50 : MAX_FREE_NOTES}
									initialScope={viewScope}
									initialType={filterType}
									onAddNote={handleAddNote}
									onAppendDiary={handleAppendDiary}
									onClose={() => setIsInputModeOpen(false)}
									textareaRef={textareaRef}
								/>
							</>
						)}
					</div>
				</>
			)}

			{/* 日記ドロワーのUIコンポーネント */}
			<div
				className={`fixed inset-y-0 right-0 w-full bg-base-surface z-50 transform transition-transform duration-300 ease-in-out flex flex-col h-full font-sans ${
					isDiaryOpen ? "translate-x-0" : "translate-x-full"
				}`}
			>
				{/* 1. 最上部ヘッダー：完全不動固定マウント */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-base-border/40 shrink-0">
					<div className="flex items-center justify-between gap-4 w-full">
						<h1 className="text-lg font-bold text-base-text">Diary</h1>
						<button
							type="button"
							onClick={handleCloseDiary}
							className="cursor-pointer size-8 flex items-center justify-center rounded-full bg-base-bg hover:bg-base-surface text-muted-foreground border border-base-border"
							title="Close diary"
						>
							<X aria-hidden="true" className="size-5" />
						</button>
					</div>
				</div>

				{/* 2. コンテンツコンテナ窓：
				   🚨 既存の p-3 や overflow-y-auto は完全に排除し、flex-1 min-h-0 で子コンポーネントへ領域を100%パスする */}
				<div className="flex-1 min-h-0 w-full p-3 flex flex-col">
					<DiaryView
						selectedDiaryDate={selectedDiaryDate}
						setSelectedDiaryDate={setSelectedDiaryDate}
						diaryData={diaryData}
						isDiaryLoading={isDiaryLoading}
						isEditingDiary={isEditingDiary}
						setIsEditingDiary={setIsEditingDiary}
						editDiaryContent={editDiaryContent}
						setEditDiaryContent={setEditDiaryContent}
						editDiaryTopics={editDiaryTopics}
						setEditDiaryTopics={setEditDiaryTopics}
						basecampArchiveUrl={basecampArchiveUrl}
						updateDiaryMutationPending={updateDiaryMutation.isPending}
						handleSaveDiaryEdit={handleSaveDiaryEdit}
						handleStartEdit={handleStartEdit}
					/>
				</div>
			</div>
		</div>
	);
}
