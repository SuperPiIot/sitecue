"use client";

import { fetchOrResetUserProfile, SHARED_LIMITS } from "@sitecue/shared";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { Activity, LogOut, Settings, Sparkles, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CustomLink as Link } from "@/components/ui/custom-link";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useFetchDrafts } from "@/hooks/useDraftsQuery";
import { useFetchNotes } from "@/hooks/useNotesQuery";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/useUserStore";
import { createClient } from "@/utils/supabase/client";

export interface UserMenuProps {
	side?: "top" | "right" | "bottom" | "left";
	align?: "start" | "center" | "end";
	sideOffset?: number;
}

export function UserMenu({
	side = "right",
	align = "end",
	sideOffset = 16,
}: UserMenuProps = {}) {
	const router = useRouter();
	const supabase = createClient();
	const [user, setUser] = useState<SupabaseUser | null>(null);
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const { aiUsageCount, plan, setUserData } = useUserStore();
	const { data: notes = [] } = useFetchNotes();
	const { data: drafts = [] } = useFetchDrafts();

	useEffect(() => {
		const getUserAndProfile = async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			setUser(user);

			if (user) {
				// DAL 経由で Lazy Reset 判定を含むプロフィール情報を取得
				const profileData = await fetchOrResetUserProfile(supabase, user.id);
				if (profileData) {
					setUserData(profileData.ai_usage_count, profileData.plan);
				}
			}
		};
		getUserAndProfile();
	}, [supabase, setUserData]);

	const handleSignOut = async () => {
		await supabase.auth.signOut();
		router.push("/login");
		router.refresh();
	};

	if (!user) return null;

	const { AI_LIMIT, NOTES_LIMIT, DRAFTS_LIMIT } = SHARED_LIMITS;

	return (
		<Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
			<PopoverTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-9 border-none p-0 bg-base-surface text-action shadow-sm overflow-hidden hover-safe:border-action"
						aria-label="User menu"
					>
						{user.user_metadata?.avatar_url ? (
							// biome-ignore lint/performance/noImgElement: External OAuth avatar
							<img
								src={user.user_metadata.avatar_url}
								alt=""
								className="h-full w-full object-cover"
							/>
						) : (
							<User className="size-5" aria-hidden="true" />
						)}
					</Button>
				}
			/>

			<PopoverContent
				side={side}
				align={align}
				sideOffset={sideOffset}
				className="w-64 p-2 z-[100]"
			>
				<div className="px-3 py-2 mb-1 border-b border-base-border/50">
					<p className="text-sm font-semibold text-action truncate">
						{user.email}
					</p>
					<p className="text-[10px] text-neutral-400 font-medium">My Account</p>
				</div>

				<div className="px-3 py-2 mb-1 border-b border-base-border/50">
					{(() => {
						const maxAiLimit =
							plan === "pro" ? AI_LIMIT.MAX_PRO : AI_LIMIT.MAX_FREE;
						const aiWarningThreshold =
							plan === "pro"
								? AI_LIMIT.WARNING_THRESHOLD_PRO
								: AI_LIMIT.WARNING_THRESHOLD_FREE;
						const isAiWarning =
							aiUsageCount !== null && aiUsageCount >= aiWarningThreshold;

						return (
							<>
								<p
									className={cn(
										"text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1",
										isAiWarning ? "text-amber-600" : "text-neutral-400",
									)}
								>
									<Sparkles className="w-3 h-3" />
									AI Usage
								</p>
								<p
									className={cn(
										"text-sm",
										isAiWarning ? "text-amber-700" : "text-action",
									)}
								>
									{aiUsageCount !== null
										? `${aiUsageCount} / ${maxAiLimit}`
										: "..."}
									<span
										className={cn(
											"text-[10px] font-normal ml-1",
											isAiWarning ? "text-amber-500" : "text-neutral-400",
										)}
									>
										uses
									</span>
								</p>
							</>
						);
					})()}
				</div>

				{notes.length >= NOTES_LIMIT.WARNING_THRESHOLD && (
					<div className="px-3 py-2 mb-1 border-b border-base-border/50">
						<p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1 flex items-center gap-1">
							<Activity className="w-3 h-3" aria-hidden="true" />
							Note Storage
						</p>
						<p className="text-sm text-amber-700">
							{notes.length} / {NOTES_LIMIT.MAX_FREE}
							<span className="text-[10px] font-normal text-amber-500 ml-1">
								notes
							</span>
						</p>
					</div>
				)}

				{drafts.length >= DRAFTS_LIMIT.WARNING_THRESHOLD && (
					<div className="px-3 py-2 mb-1 border-b border-base-border/50">
						<p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1 flex items-center gap-1">
							<Activity className="w-3 h-3" aria-hidden="true" />
							Draft Storage
						</p>
						<p className="text-sm text-amber-700">
							{drafts.length} / {DRAFTS_LIMIT.MAX_FREE}
							<span className="text-[10px] font-normal text-amber-500 ml-1">
								drafts
							</span>
						</p>
					</div>
				)}

				<Link
					href="/templates"
					onClick={() => setIsMenuOpen(false)}
					className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-base-bg hover:text-action cursor-pointer mb-1"
				>
					<Settings className="h-4 w-4" aria-hidden="true" />
					Manage Templates
				</Link>
				<button
					type="button"
					onClick={handleSignOut}
					className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-note-alert transition-colors hover:bg-note-alert/10 cursor-pointer"
				>
					<LogOut className="h-4 w-4" aria-hidden="true" />
					Log out
				</button>
			</PopoverContent>
		</Popover>
	);
}
