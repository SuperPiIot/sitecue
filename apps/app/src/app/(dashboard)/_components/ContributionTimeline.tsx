"use client";

import {
	buildNoteContextHref,
	type DashboardActivityData,
} from "@sitecue/shared";
import { Edit3, FileText, Zap } from "lucide-react";
import { CustomLink as Link } from "@/components/ui/custom-link";
import { DomainFavicon } from "./DomainFavicon";

export interface ActivityItem {
	id: string;
	title: string;
	content?: string;
	domain?: string;
	noteType?: "info" | "alert" | "idea";
	scope?: "exact" | "domain" | "inbox";
	isResolved?: boolean;
}

export interface ActivityEvent {
	type: "note_captured" | "draft_created";
	label: string;
	items: ActivityItem[];
}

export interface DailyActivity {
	date: string;
	displayDate: string;
	noteCount: number;
	draftCount: number;
	events: ActivityEvent[];
}

function getLocalDateString(date: Date) {
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}

function getDisplayDate(dateStr: string) {
	const todayStr = getLocalDateString(new Date());
	if (dateStr === todayStr) return "Today";
	const d = new Date(`${dateStr}T00:00:00`);
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		weekday: "short",
	});
}

function extractDomain(url: string): string {
	if (!url || url === "inbox") return "inbox";
	const cleanUrl = url.replace(/^(?:https?:\/\/)?(?:www\.)?/, "");
	return cleanUrl.split("/")[0];
}

export function ContributionTimeline({
	notes = [],
	drafts = [],
}: {
	notes?: DashboardActivityData["notes7d"];
	drafts?: DashboardActivityData["drafts7d"];
}) {
	if (notes.length === 0 && drafts.length === 0) {
		return (
			<div className="rounded-xl border border-dashed border-base-border p-8 text-center text-sm text-neutral-500">
				No recent activities logged in the last 7 days.
			</div>
		);
	}

	const activityMap: Record<
		string,
		{ noteItems: ActivityItem[]; draftItems: ActivityItem[] }
	> = {};

	for (const note of notes) {
		const dateKey = getLocalDateString(new Date(note.created_at));
		if (!activityMap[dateKey]) {
			activityMap[dateKey] = { noteItems: [], draftItems: [] };
		}
		activityMap[dateKey].noteItems.push({
			id: note.id,
			title: note.scope === "inbox" ? "Inbox" : note.url_pattern || "",
			content: note.content || "",
			domain: extractDomain(note.url_pattern || ""),
			noteType: note.note_type,
			scope: note.scope,
			isResolved: note.is_resolved,
		});
	}

	for (const draft of drafts) {
		const dateKey = getLocalDateString(new Date(draft.created_at));
		if (!activityMap[dateKey]) {
			activityMap[dateKey] = { noteItems: [], draftItems: [] };
		}
		activityMap[dateKey].draftItems.push({
			id: draft.id,
			title: draft.title || "Untitled Draft",
			content: draft.content || "",
		});
	}

	const dailyActivities: DailyActivity[] = Object.keys(activityMap)
		.sort((a, b) => b.localeCompare(a))
		.map((dateKey) => {
			const { noteItems, draftItems } = activityMap[dateKey];
			const events: ActivityEvent[] = [];

			if (noteItems.length > 0) {
				events.push({
					type: "note_captured",
					label: "Captured Notes",
					items: noteItems,
				});
			}

			if (draftItems.length > 0) {
				events.push({
					type: "draft_created",
					label: "Created Drafts",
					items: draftItems,
				});
			}

			return {
				date: dateKey,
				displayDate: getDisplayDate(dateKey),
				noteCount: noteItems.length,
				draftCount: draftItems.length,
				events,
			};
		});

	return (
		<div className="flex flex-col border-l border-base-border ml-2 pl-4 gap-4 w-full min-w-0 min-h-[160px]">
			{dailyActivities.map((day) => (
				<div
					key={day.date}
					className="relative flex flex-col gap-2 group w-full min-w-0"
				>
					<div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-600 ring-4 ring-base-bg transition-transform duration-300 group-hover:scale-125" />
					<div className="flex items-center gap-2">
						<span className="text-xs font-semibold text-action">
							{day.displayDate}
						</span>
						<span className="text-[10px] text-neutral-400 font-mono">
							({day.noteCount + day.draftCount} activities)
						</span>
					</div>

					<div className="flex flex-col gap-2 pl-2 border-l border-neutral-100 dark:border-neutral-800 w-full min-w-0">
						{day.events.map((event) => (
							<div
								key={event.type}
								className="flex flex-col gap-1 w-full min-w-0"
							>
								<div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-neutral-400">
									{event.type === "note_captured" ? (
										<FileText
											aria-hidden="true"
											className="w-2.5 h-2.5 text-neutral-400"
										/>
									) : (
										<Edit3
											aria-hidden="true"
											className="w-3 h-3 text-neutral-400"
										/>
									)}
									<span>{event.label}</span>
								</div>

								<div className="flex flex-col w-full min-w-0">
									{event.items.map((item) => {
										let href = "";
										if (event.type === "draft_created") {
											href = `/studio/${item.id}`;
										} else {
											href = buildNoteContextHref({
												id: item.id,
												scope: item.scope,
												url_pattern: item.title,
											});
										}

										let dotColor = "bg-action";
										if (event.type === "note_captured") {
											dotColor = "bg-neutral-400";
											if (item.noteType === "idea") dotColor = "bg-note-idea";
											if (item.noteType === "info") dotColor = "bg-note-info";
											if (item.noteType === "alert") dotColor = "bg-note-alert";
										}

										const contentPreview = item.content
											? item.content.replace(/[#*`-]/g, "")
											: "No content preview";

										return (
											<Link
												key={item.id}
												href={href}
												className="grid grid-cols-[12px_1fr] gap-3 items-center text-xs text-neutral-500 hover-safe:text-action transition-colors w-full min-w-0 group/item"
											>
												<div className="flex md:items-center justify-center h-5 w-3 shrink-0">
													<div
														className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`}
													/>
												</div>

												<div className="grid grid-cols-1 md:grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-center gap-x-3 md:gap-y-1 min-w-0 w-full min-h-[20px]">
													<div className="flex items-center gap-2 min-w-0 shrink-0 h-5">
														{event.type === "note_captured" &&
															item.scope !== "inbox" && (
																<DomainFavicon
																	domain={item.domain || item.title}
																	sizeClassName="w-3 h-3"
																/>
															)}
														{event.type === "note_captured" &&
															item.scope === "inbox" && (
																<Zap
																	aria-hidden="true"
																	className="w-3 h-3 text-yellow-500 shrink-0"
																/>
															)}
														<span
															className="font-semibold text-action truncate max-w-[200px] md:max-w-[300px] leading-none pt-[1px]"
															title={item.title}
														>
															{item.title}
														</span>
													</div>

													<div className="flex items-center gap-2 min-w-0 w-full h-5">
														<span className="hidden md:inline text-neutral-300 shrink-0 select-none leading-none">
															•
														</span>
														<span
															className={`truncate text-neutral-400 group-hover/item:text-neutral-500 transition-colors w-full leading-none ${
																item.isResolved ? "line-through opacity-50" : ""
															}`}
															title={contentPreview}
														>
															{contentPreview}
														</span>
													</div>
												</div>
											</Link>
										);
									})}
								</div>
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
