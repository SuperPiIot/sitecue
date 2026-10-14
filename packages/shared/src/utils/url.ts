export function getSafeUrl(urlString: string): URL | null {
	try {
		if (!urlString.startsWith("http")) return null;
		return new URL(urlString);
	} catch (_error) {
		return null;
	}
}

/**
 * グルーピング用のURL正規化
 * - プロトコル (http://, https://) を削除
 * - www. を削除
 * - 末尾の / を削除
 */
export function normalizeUrlForGrouping(url: string): string {
	let normalized = url.replace(/^(https?:\/\/)?(www\.)?/, "");
	if (normalized.endsWith("/")) {
		normalized = normalized.slice(0, -1);
	}
	return normalized;
}

export function normalizeUrl(url: string, scope: "domain" | "exact"): string {
	const safeUrl = getSafeUrl(url.startsWith("http") ? url : `https://${url}`);
	if (!safeUrl) {
		return normalizeUrlForGrouping(url);
	}

	if (scope === "domain") {
		return normalizeUrlForGrouping(safeUrl.host);
	} else {
		return normalizeUrlForGrouping(
			safeUrl.host + safeUrl.pathname + safeUrl.search,
		);
	}
}

/**
 * 現在のURLから、検索対象となる全てのURLパターンを取得する
 */
export function getScopeUrls(currentUrl: string): {
	domain: string;
	exact: string;
} {
	return {
		domain: normalizeUrl(currentUrl, "domain"),
		exact: normalizeUrl(currentUrl, "exact"),
	};
}

export interface BuildNoteContextHrefInput {
	id: string;
	scope?: "exact" | "domain" | "inbox" | "draft" | string;
	url_pattern?: string;
	draft_id?: string | null;
}

/**
 * ノートのコンテキストに応じた詳細遷移URL (/notes?... または /studio/...) を統一生成する純粋関数。
 */
export function buildNoteContextHref(note: BuildNoteContextHrefInput): string {
	const { id, scope, url_pattern = "", draft_id } = note;

	if (scope === "draft") {
		if (draft_id) {
			return `/studio/${encodeURIComponent(draft_id)}`;
		}
		if (url_pattern.startsWith("sitecue://draft/")) {
			const extractedId = url_pattern.replace("sitecue://draft/", "").trim();
			if (extractedId) {
				return `/studio/${encodeURIComponent(extractedId)}`;
			}
		}
		return "/notes?view=drafts";
	}

	if (scope === "inbox") {
		return `/notes?view=inbox&noteId=${encodeURIComponent(id)}`;
	}

	if (scope === "domain") {
		const domain = normalizeUrl(url_pattern, "domain") || "inbox";
		if (domain === "inbox") {
			return `/notes?view=inbox&noteId=${encodeURIComponent(id)}`;
		}
		return `/notes?domain=${encodeURIComponent(domain)}&view=domains&exact=domain&noteId=${encodeURIComponent(id)}`;
	}

	if (scope === "exact") {
		// 過去のバグにより url_pattern === "domain" や "inbox" となったノートの救済
		if (!url_pattern || url_pattern === "inbox" || url_pattern === "domain") {
			return `/notes?q=${encodeURIComponent(url_pattern || "")}&noteId=${encodeURIComponent(id)}`;
		}
		const domain = normalizeUrl(url_pattern, "domain") || "inbox";
		return `/notes?domain=${encodeURIComponent(domain)}&view=domains&exact=${encodeURIComponent(url_pattern)}&noteId=${encodeURIComponent(id)}`;
	}

	// デフォルトフォールバック
	return `/notes?view=inbox&noteId=${encodeURIComponent(id)}`;
}
