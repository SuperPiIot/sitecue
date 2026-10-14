import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchDashboardDomainActivity } from "./notes";

export interface TodayFocusMeta {
	todayStr: string;
	monthYearStr: string;
	dayNumStr: string;
	weekdayStr: string;
	currentYear: string;
	currentMonth: string;
	startOfDay: string;
}

export interface DashboardActivityData extends TodayFocusMeta {
	todayTotal: number;
	noteCount7d: number;
	draftCount7d: number;
	recentNotes: Array<{
		id: string;
		content: string | null;
		is_resolved: boolean;
		scope: "inbox" | "domain" | "exact";
		url_pattern: string;
		created_at: string;
	}>;
	recentDrafts: Array<{
		id: string;
		title: string | null;
		content: string | null;
		created_at: string;
	}>;
	notes7d: Array<{
		id: string;
		content: string | null;
		is_resolved: boolean;
		scope: "inbox" | "domain" | "exact";
		url_pattern: string;
		created_at: string;
		note_type: "info" | "alert" | "idea";
	}>;
	drafts7d: Array<{
		id: string;
		title: string | null;
		content: string | null;
		created_at: string;
	}>;
}

export interface DashboardOverviewData extends DashboardActivityData {
	domainActivities: Awaited<ReturnType<typeof fetchDashboardDomainActivity>>;
}

export function getTodayFocusMeta(now: Date = new Date()): TodayFocusMeta {
	const jstTime = now.getTime() + 9 * 60 * 60 * 1000;
	const jstDate = new Date(jstTime);
	const year = jstDate.getUTCFullYear();
	const month = String(jstDate.getUTCMonth() + 1).padStart(2, "0");
	const day = String(jstDate.getUTCDate()).padStart(2, "0");
	const todayStr = `${year}-${month}-${day}`;
	const startOfDay = `${todayStr}T00:00:00+09:00`;

	return {
		todayStr,
		monthYearStr: jstDate
			.toLocaleDateString("en-US", {
				month: "short",
				year: "numeric",
				timeZone: "UTC",
			})
			.toUpperCase(),
		dayNumStr: day,
		weekdayStr: jstDate
			.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })
			.toUpperCase(),
		currentYear: year.toString(),
		currentMonth: month,
		startOfDay,
	};
}

export async function fetchDashboardActivityData(
	supabase: SupabaseClient,
	userId: string,
): Promise<DashboardActivityData> {
	const meta = getTodayFocusMeta();
	const startOfDayTime = new Date(meta.startOfDay).getTime();

	const sevenDaysAgo = new Date();
	sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
	const dateStr = sevenDaysAgo.toISOString();

	const [{ data: notes7dData }, { data: drafts7dData }] = await Promise.all([
		supabase
			.from("sitecue_notes")
			.select(
				"id, content, is_resolved, scope, url_pattern, created_at, note_type",
			)
			.eq("user_id", userId)
			.neq("scope", "draft")
			.gte("created_at", dateStr)
			.order("created_at", { ascending: false }),
		supabase
			.from("sitecue_drafts")
			.select("id, title, content, created_at")
			.eq("user_id", userId)
			.gte("created_at", dateStr)
			.order("created_at", { ascending: false }),
	]);

	const notes7d = (notes7dData as DashboardActivityData["notes7d"]) ?? [];
	const drafts7d = (drafts7dData as DashboardActivityData["drafts7d"]) ?? [];

	const todayNotesCount = notes7d.filter(
		(n) => new Date(n.created_at).getTime() >= startOfDayTime,
	).length;
	const todayDraftsCount = drafts7d.filter(
		(d) => new Date(d.created_at).getTime() >= startOfDayTime,
	).length;

	let recentNotes: DashboardActivityData["recentNotes"] = notes7d.slice(0, 5);
	if (notes7d.length < 5) {
		const { data: fallbackNotes } = await supabase
			.from("sitecue_notes")
			.select("id, content, is_resolved, scope, url_pattern, created_at")
			.eq("user_id", userId)
			.neq("scope", "draft")
			.order("created_at", { ascending: false })
			.limit(5);
		recentNotes = (fallbackNotes as DashboardActivityData["recentNotes"]) ?? [];
	}

	let recentDrafts: DashboardActivityData["recentDrafts"] = drafts7d.slice(
		0,
		5,
	);
	if (drafts7d.length < 5) {
		const { data: fallbackDrafts } = await supabase
			.from("sitecue_drafts")
			.select("id, title, content, created_at")
			.eq("user_id", userId)
			.order("created_at", { ascending: false })
			.limit(5);
		recentDrafts =
			(fallbackDrafts as DashboardActivityData["recentDrafts"]) ?? [];
	}

	return {
		...meta,
		todayTotal: todayNotesCount + todayDraftsCount,
		noteCount7d: notes7d.length,
		draftCount7d: drafts7d.length,
		recentNotes,
		recentDrafts,
		notes7d,
		drafts7d,
	};
}

export async function fetchDashboardOverviewData(
	supabase: SupabaseClient,
	userId: string,
): Promise<DashboardOverviewData> {
	const [activityData, domainActivities] = await Promise.all([
		fetchDashboardActivityData(supabase, userId),
		fetchDashboardDomainActivity(supabase, userId, 6),
	]);

	return {
		...activityData,
		domainActivities: domainActivities ?? [],
	};
}
