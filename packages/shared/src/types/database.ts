// Note: 本番環境や完全移行時は supabase gen types の出力結果をここに配置・エクスポートする。
// 今回は共通基盤の確立としてベースの型を準備。
export interface SitecueNoteBase {
	id: string;
	created_at: string;
	updated_at: string;
	user_id: string;
	url_pattern: string;
	content: string;
	note_type: string;
	scope: string;
	is_resolved: boolean;
	is_pinned: boolean;
	is_favorite: boolean;
	sort_order: number;
	is_expanded: boolean;
	draft_id: string | null;
	tags: string[] | null;
}

export interface SitecueDraftBase {
	id: string;
	created_at: string;
	updated_at: string;
	user_id: string;
	title: string | null;
	content: string | null;
	tags: string[] | null;
	metadata: Record<string, unknown> | null;
	template_id: string | null;
}

export interface SitecueTemplateBase {
	id: string;
	created_at: string;
	user_id: string;
	name: string;
	boilerplate: string | null;
	max_length: number | null;
	weave_prompt: string | null;
}

export interface SitecuePinnedSiteBase {
	id: string;
	user_id: string;
	title: string;
	url: string;
	created_at: string;
}

export interface SitecueProfileBase {
	id: string;
	created_at: string;
	updated_at: string;
	plan: "free" | "pro";
	ai_usage_count: number;
	ai_usage_reset_at: string | null;
	polar_customer_id: string | null;
	polar_subscription_id: string | null;
}
