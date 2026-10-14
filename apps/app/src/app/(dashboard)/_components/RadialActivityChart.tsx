import { buildNoteContextHref } from "@sitecue/shared";
import type { User } from "@supabase/supabase-js";
import { Edit3, FileText } from "lucide-react";
import { CustomLink as Link } from "@/components/ui/custom-link";
import type { createClient } from "@/utils/supabase/server";

type Props = {
	supabase: Awaited<ReturnType<typeof createClient>>;
	user: User;
};

type RecentItem = {
	id: string;
	type: "note" | "draft";
	title: string;
	content: string;
	isResolved?: boolean;
	href: string;
	createdAt: string;
};

export async function RadialActivityChart({ supabase, user }: Props) {
	const sevenDaysAgo = new Date();
	sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
	const dateStr = sevenDaysAgo.toISOString();

	const [
		{ data: notes },
		{ data: drafts },
		{ data: recentNotes },
		{ data: recentDrafts },
	] = await Promise.all([
		supabase
			.from("sitecue_notes")
			.select("id")
			.eq("user_id", user.id)
			.neq("scope", "draft")
			.gte("created_at", dateStr),
		supabase
			.from("sitecue_drafts")
			.select("id")
			.eq("user_id", user.id)
			.gte("created_at", dateStr),
		supabase
			.from("sitecue_notes")
			.select("id, content, is_resolved, scope, url_pattern, created_at")
			.eq("user_id", user.id)
			.neq("scope", "draft")
			.order("created_at", { ascending: false })
			.limit(5),
		supabase
			.from("sitecue_drafts")
			.select("id, title, content, created_at")
			.eq("user_id", user.id)
			.order("created_at", { ascending: false })
			.limit(5),
	]);

	const noteCount = notes?.length || 0;
	const draftCount = drafts?.length || 0;

	// Targets for the weekly activity progress
	const targetNotes = 20;
	const targetDrafts = 5;

	// Progress percentages capped at 100%
	const notePct = Math.min(100, (noteCount / targetNotes) * 100);
	const draftPct = Math.min(100, (draftCount / targetDrafts) * 100);

	// Concentric circles parameters
	// Outer Ring (Notes): Radius 64. Circumference = 2 * PI * 64 = 402.12
	const r1 = 64;
	const c1 = 2 * Math.PI * r1;
	const offset1 = c1 - (notePct / 100) * c1;

	// Inner Ring (Drafts): Radius 48. Circumference = 2 * PI * 48 = 301.59
	const r2 = 48;
	const c2 = 2 * Math.PI * r2;
	const offset2 = c2 - (draftPct / 100) * c2;

	// Combine and sort recent items
	const rawRecentItems: RecentItem[] = [];

	if (recentNotes) {
		for (const n of recentNotes) {
			const href = buildNoteContextHref({
				id: n.id,
				scope: n.scope,
				url_pattern: n.url_pattern,
			});
			rawRecentItems.push({
				id: n.id,
				type: "note",
				title: n.url_pattern || "Note",
				content: n.content || "",
				isResolved: n.is_resolved,
				href,
				createdAt: n.created_at,
			});
		}
	}

	if (recentDrafts) {
		for (const d of recentDrafts) {
			rawRecentItems.push({
				id: d.id,
				type: "draft",
				title: d.title || "Untitled Draft",
				content: d.content || "",
				href: `/studio/${d.id}`,
				createdAt: d.created_at,
			});
		}
	}

	const recentItems = rawRecentItems
		.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		)
		.slice(0, 5);

	return (
		<div className="flex flex-col gap-6 p-6 rounded-xl border border-base-border md:col-span-2 h-full justify-between">
			<div className="flex flex-col md:flex-row items-center gap-6 flex-1 my-auto">
				<div className="relative w-32 h-32 flex items-center justify-center shrink-0">
					<svg
						className="w-full h-full transform -rotate-90"
						viewBox="0 0 160 160"
						aria-label="Weekly activity circular progress chart"
						role="img"
					>
						{/* Outer Track (Notes) */}
						<circle
							cx="80"
							cy="80"
							r={r1}
							className="stroke-neutral-100 dark:stroke-neutral-800"
							strokeWidth="8"
							fill="transparent"
						/>
						{/* Outer Progress (Notes) */}
						<circle
							cx="80"
							cy="80"
							r={r1}
							stroke="var(--color-note-info)"
							strokeWidth="8"
							fill="transparent"
							strokeDasharray={c1}
							strokeDashoffset={offset1}
							strokeLinecap="round"
							className="transition-all duration-500 ease-out"
						/>

						{/* Inner Track (Drafts) */}
						<circle
							cx="80"
							cy="80"
							r={r2}
							className="stroke-neutral-100 dark:stroke-neutral-800"
							strokeWidth="8"
							fill="transparent"
						/>
						{/* Inner Progress (Drafts) */}
						<circle
							cx="80"
							cy="80"
							r={r2}
							stroke="var(--color-note-idea)"
							strokeWidth="8"
							fill="transparent"
							strokeDasharray={c2}
							strokeDashoffset={offset2}
							strokeLinecap="round"
							className="transition-all duration-500 ease-out"
						/>
					</svg>

					{/* Center Content */}
					<div className="absolute flex flex-col items-center justify-center text-center">
						<span className="text-2xl font-bold tracking-tight text-action">
							{noteCount + draftCount}
						</span>
						<span className="text-[8px] uppercase tracking-wider text-neutral-500 font-mono">
							Activities
						</span>
					</div>
				</div>

				<div className="flex-1 flex flex-col justify-center gap-4 w-full">
					<div>
						<h3 className="text-xl font-bold text-action">Weekly Progress</h3>
						<p className="text-xs text-neutral-500 mt-0.5">
							Your note-taking activity over the last 7 days.
						</p>
					</div>

					<div className="flex flex-col gap-3">
						{/* Notes captured row */}
						<div className="flex items-center justify-between text-xs">
							<div className="flex items-center gap-2">
								<div className="w-2.5 h-2.5 rounded-full bg-note-info shrink-0" />
								<FileText
									className="w-3.5 h-3.5 text-neutral-500"
									aria-hidden="true"
								/>
								<span className="font-medium text-action">Notes Captured</span>
							</div>
							<div className="font-mono text-neutral-600 font-bold text-sm">
								{noteCount}
							</div>
						</div>

						{/* Drafts created row */}
						<div className="flex items-center justify-between text-xs">
							<div className="flex items-center gap-2">
								<div className="w-2.5 h-2.5 rounded-full bg-note-idea shrink-0" />
								<Edit3
									className="w-3.5 h-3.5 text-neutral-500"
									aria-hidden="true"
								/>
								<span className="font-medium text-action">Drafts Created</span>
							</div>
							<div className="font-mono text-neutral-600 font-bold text-sm">
								{draftCount}
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Recent Items Section */}
			{recentItems.length > 0 && (
				<div className="pt-4 border-t border-base-border/60 flex flex-col gap-2 w-full min-w-0 shrink-0">
					<span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
						Recent Items
					</span>
					<div className="flex flex-col gap-1.5 w-full min-w-0">
						{recentItems.map((item) => (
							<Link
								key={item.id}
								href={item.href}
								className="grid grid-cols-[14px_minmax(0,1fr)] gap-2 items-center text-xs text-neutral-600 hover-safe:text-action transition-colors w-full min-w-0"
							>
								<div className="shrink-0">
									{item.type === "note" ? (
										<FileText
											className="w-3.5 h-3.5 text-neutral-400"
											aria-hidden="true"
										/>
									) : (
										<Edit3
											className="w-3.5 h-3.5 text-neutral-400"
											aria-hidden="true"
										/>
									)}
								</div>
								<span
									className={`truncate font-sans ${
										item.isResolved ? "line-through opacity-50" : ""
									}`}
									title={item.content || item.title}
								>
									{item.content
										? item.content.replace(/[#*`-]/g, "")
										: item.title}
								</span>
							</Link>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
