import type { Session } from "@supabase/supabase-js";
import {
	CalendarDays,
	CircleOff,
	ExternalLink,
	Glasses,
	Lock,
	LogOut,
	Unlock,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { AuthStatus } from "../hooks/useAuth";
import { localClient, supabase } from "../supabaseClient";

interface HeaderProps {
	url: string;
	title: string;
	domain: string; // Used for settings key
	session: Session | null;
	onLogout: () => void;
	authStatus: AuthStatus;
	onDiaryClick?: () => void;
	isLocked?: boolean;
	onToggleLock?: () => void;
}

interface DomainSettings {
	color: string;
	label: string;
}

const COLORS = [
	{ name: "Blue", value: "blue-400", hex: "#60a5fa" }, // Blue
	{ name: "Red", value: "rose-400", hex: "#fb7185" }, // Rose
	{ name: "Yellow", value: "amber-400", hex: "#fbbf24" }, // Amber
	{ name: "Green", value: "emerald-400", hex: "#34d399" }, // Emerald
	{ name: "Purple", value: "violet-400", hex: "#a78bfa" }, // Violet
];

// ドメイン設定カラーの hex 解決ヘルパー
const getColorHex = (colorName?: string) => {
	if (!colorName) return undefined;
	return COLORS.find((c) => c.value === colorName)?.hex;
};

export default function Header({
	url,
	title,
	domain,
	session,
	onLogout,
	authStatus,
	onDiaryClick,
	isLocked = false,
	onToggleLock,
}: HeaderProps) {
	const [settings, setSettings] = useState<DomainSettings | null>(null);
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const [editColor, setEditColor] = useState("sky-600");
	const [editLabel, setEditLabel] = useState("");
	const [saving, setSaving] = useState(false);
	const [isProfileOpen, setIsProfileOpen] = useState(false);
	const profileMenuRef = useRef<HTMLDivElement>(null);

	const client = authStatus.mode === "guest" ? localClient : supabase;

	const avatarUrl = session?.user?.user_metadata?.avatar_url;
	const emailInitial =
		authStatus.mode === "guest"
			? "G"
			: session?.user?.email?.[0]?.toUpperCase() || "?";
	const webUrl = import.meta.env.VITE_WEB_URL || "https://app.sitecue.app";

	// Close menu on outside click
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				profileMenuRef.current &&
				!profileMenuRef.current.contains(event.target as Node)
			) {
				setIsProfileOpen(false);
			}
		};
		if (isProfileOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isProfileOpen]);

	const fetchSettings = useCallback(async () => {
		if (authStatus.mode === "loading") return;
		const { data } = await (client as unknown as typeof supabase)
			.from("sitecue_domain_settings")
			.select("*")
			.eq("domain", domain)
			.maybeSingle();

		if (data) {
			setSettings({ color: data.color ?? "", label: data.label ?? "" });
			setEditColor(data.color || "sky-600");
			setEditLabel(data.label || "");
		} else {
			setSettings(null);
			setEditColor(""); // Default to empty/cleared for new settings

			setEditLabel("");
		}
	}, [domain, authStatus.mode, client]);

	useEffect(() => {
		if (!domain || authStatus.mode === "loading") return;
		fetchSettings();
	}, [domain, authStatus.mode, fetchSettings]);

	const handleSave = async () => {
		if (!domain || authStatus.mode === "loading") return;
		const currentUserId =
			authStatus.mode === "guest" ? "guest-user" : session?.user?.id;
		if (!currentUserId) return;

		setSaving(true);
		try {
			if (editColor === "") {
				// Delete settings if cleared
				const { error } = await (client as unknown as typeof supabase)
					.from("sitecue_domain_settings")
					.delete()
					.eq("user_id", currentUserId)
					.eq("domain", domain);

				if (error) throw error;
			} else {
				// Upsert settings
				const { error } = await (client as unknown as typeof supabase)
					.from("sitecue_domain_settings")
					.upsert(
						{
							user_id: currentUserId,
							domain: domain,
							color: editColor,
							label: editLabel.trim() || null,
						},
						{ onConflict: "user_id, domain" },
					);

				if (error) throw error;
			}

			setIsSettingsOpen(false);
			fetchSettings();
			toast.success("Settings saved");
		} catch (error) {
			console.error("Failed to save domain settings", error);
			toast.error("Failed to save settings");
		} finally {
			setSaving(false);
		}
	};

	const colorHex = getColorHex(settings?.color);

	return (
		<div
			style={{
				borderColor: isLocked ? colorHex || undefined : undefined,
			}}
			className={`p-2 bg-base-surface border-b sticky top-0 z-50 w-full min-w-0 transition-colors ${
				isLocked && !colorHex ? "border-action" : "border-base-border"
			}`}
		>
			{/* 📐 完璧に対称性を保護し、カプセル膨張時の窒息を防ぐGridトラック設計 */}
			<div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 w-full">
				<div className="min-w-0 flex flex-col justify-center">
					<h1 className="text-lg font-semibold text-action flex items-center gap-2 w-full min-w-0">
						{/* 鍵ボタン（旧ドットボタン） */}
						<button
							type="button"
							onClick={onToggleLock}
							style={{
								backgroundColor: isLocked ? colorHex || undefined : undefined,
								color: !isLocked && colorHex ? colorHex : undefined,
							}}
							className={`cursor-pointer size-6 rounded-full shrink-0 flex items-center justify-center transition-all ${
								isLocked
									? `shadow-xs ${!colorHex ? "bg-action text-action-text" : "text-white"}`
									: `hover:bg-base-surface ${!colorHex ? "text-muted-foreground/50 hover:text-action" : ""}`
							}`}
							title={
								isLocked
									? "Unlock URL (currently locked)"
									: "Lock URL (keep current notes visible across tabs)"
							}
							aria-label={isLocked ? "Unlock URL" : "Lock URL"}
						>
							{isLocked ? (
								<Lock className="size-3.5" aria-hidden="true" />
							) : (
								<Unlock className="size-3.5" aria-hidden="true" />
							)}
						</button>

						{/* タイトル（クリックで設定開閉） */}
						<button
							type="button"
							onClick={() => setIsSettingsOpen(!isSettingsOpen)}
							className="truncate flex-1 min-w-0 text-left cursor-pointer hover:bg-base-surface/80 rounded px-1 -mx-1 transition-colors"
							title="Click to edit label & color"
						>
							<span className="truncate block font-semibold text-action">
								{title || "sitecue"}
							</span>
						</button>

						{/* ラベルバッジ（クリックで設定開閉） */}
						{settings?.label && (
							<button
								type="button"
								onClick={() => setIsSettingsOpen(!isSettingsOpen)}
								className="text-[10px] bg-action text-action-text px-1.5 py-0.5 rounded border border-base-border font-mono shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
								title="Click to edit label & color"
							>
								{settings.label}
							</button>
						)}
					</h1>
					<p
						className={`text-xs truncate w-full transition-colors ${
							isLocked ? "text-action/80 font-medium" : "text-muted-foreground"
						}`}
						title={url}
					>
						{url || "Waiting..."}
					</p>
				</div>

				<div className="flex items-center gap-1.5 shrink-0">
					{onDiaryClick && (
						<button
							type="button"
							onClick={onDiaryClick}
							className="cursor-pointer p-1.5 rounded-full border border-base-border text-muted-foreground bg-base-bg hover:text-action hover:bg-base-border transition-colors"
							title="Open diary"
						>
							<CalendarDays className="size-4" aria-hidden="true" />
						</button>
					)}

					{/* Profile Dropdown Area */}
					<div className="relative" ref={profileMenuRef}>
						<button
							type="button"
							onClick={() => setIsProfileOpen(!isProfileOpen)}
							// 📋 ゲストモード時にカプセル型へ動的モーフィングさせるクラス結合
							className={`cursor-pointer border border-base-border hover:opacity-80 transition-all focus:outline-none shrink-0 flex items-center justify-center ${
								authStatus.mode === "guest"
									? "bg-neutral-800 text-neutral-200 px-2.5 py-1 gap-1 text-xs font-medium rounded-full border-neutral-700 shadow-sm"
									: "w-6.5 h-6.5 rounded-full overflow-hidden"
							}`}
							title="Account & Status"
						>
							{authStatus.mode === "guest" ? (
								<>
									<Glasses
										className="w-3.5 h-3.5 text-neutral-400"
										aria-hidden="true"
									/>
									<span>Guest</span>
								</>
							) : avatarUrl ? (
								<img
									src={avatarUrl}
									alt="Avatar"
									className="w-full h-full object-cover"
								/>
							) : (
								<div className="w-full h-full bg-base-surface flex items-center justify-center text-[10px] font-bold text-action">
									{emailInitial}
								</div>
							)}
						</button>

						{isProfileOpen && (
							<div className="absolute right-0 top-full mt-2 bg-base-surface border border-base-border rounded-md shadow-md z-20 py-1 min-w-[210px] animate-in fade-in slide-in-from-top-1 duration-200">
								{authStatus.mode === "guest" ? (
									// 🛡️ 英語化されたリスク・免責の3段特設インライン構成
									<div className="p-3 space-y-2.5">
										<div className="text-[11px] text-note-alert font-medium leading-normal flex gap-1 items-start">
											<span>⚠️</span>
											<span>
												Local Storage Only: Data may be lost if browser cache or
												extension data is cleared.
											</span>
										</div>
										<div className="text-[11px] text-muted-foreground leading-normal border-t border-base-border/50 pt-2 font-normal">
											*Signing in switches to the cloud environment. Current
											local notes will not be synced.
										</div>
										<div className="pt-1">
											<button
												type="button"
												onClick={() => {
													setIsProfileOpen(false);
													onLogout();
												}}
												className="cursor-pointer text-action border border-base-border rounded-full w-full py-1.5 text-center text-xs font-semibold bg-base-bg hover:bg-base-border transition-colors block"
											>
												Sign in
											</button>
										</div>
									</div>
								) : (
									<>
										<a
											href={webUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-action hover:bg-base-bg transition-colors"
											onClick={() => setIsProfileOpen(false)}
										>
											Open Basecamp{" "}
											<ExternalLink
												className="w-3.5 h-3.5 ml-auto text-muted-foreground"
												aria-hidden="true"
											/>
										</a>
										<button
											type="button"
											onClick={() => {
												setIsProfileOpen(false);
												onLogout();
											}}
											className="cursor-pointer flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-note-alert hover:bg-note-alert/10 transition-colors"
										>
											Log out{" "}
											<LogOut
												className="w-3.5 h-3.5 ml-auto"
												aria-hidden="true"
											/>
										</button>
									</>
								)}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Settings Popup / Expandable Area */}
			{isSettingsOpen && (
				<div className="mt-3 pt-3 border-t border-base-border animate-in slide-in-from-top-2 fade-in duration-200">
					<div className="space-y-3">
						<div>
							<label
								htmlFor="label-input"
								className="text-xs font-medium text-muted-foreground mb-1.5 block"
							>
								Label
							</label>
							<input
								id="label-input"
								type="text"
								value={editLabel}
								onChange={(e) => setEditLabel(e.target.value.slice(0, 10))}
								placeholder="e.g. PROD, DEV"
								className="w-full text-xs text-action border border-base-border rounded-full p-1.5 focus:outline-none focus:ring-1 focus:ring-action placeholder-muted-foreground"
							/>
						</div>
						<div>
							<label
								htmlFor="color-button"
								className="text-xs font-medium text-muted-foreground mb-1.5 block"
							>
								Color
							</label>
							<div className="flex gap-2 items-center">
								<button
									id="color-button"
									type="button"
									onClick={() => setEditColor("")}
									className={`cursor-pointer w-4 h-4 rounded-full transition-all flex items-center justify-center border border-transparent text-muted-foreground hover:text-action ${editColor === "" ? "text-action bg-base-bg" : ""}`}
									title="Clear Settings"
								>
									<CircleOff className="w-3.5 h-3.5" aria-hidden="true" />
								</button>
								{COLORS.map((c) => (
									<button
										type="button"
										key={c.value}
										onClick={() => setEditColor(c.value)}
										className={`cursor-pointer w-4 h-4 rounded-full transition-all ${editColor === c.value ? "scale-130 ring-2 ring-offset-1 ring-base-border" : "border-transparent hover:scale-130"}`}
										style={{ backgroundColor: c.hex }}
										title={c.name}
									/>
								))}
							</div>
						</div>
						<div className="flex justify-end gap-2 pt-1">
							<button
								type="button"
								onClick={() => setIsSettingsOpen(false)}
								className="cursor-pointer px-3 py-1 text-xs text-muted-foreground hover:text-action hover:bg-base-border rounded-full"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleSave}
								disabled={saving}
								className="cursor-pointer px-3 py-1 bg-action text-action-text text-xs rounded-full hover:bg-action-hover disabled:opacity-50 flex items-center gap-1"
							>
								{saving ? "Saving..." : "Save"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
