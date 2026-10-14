import { describe, expect, it } from "vitest";
import {
	buildNoteContextHref,
	getSafeUrl,
	getScopeUrls,
	normalizeUrl,
	normalizeUrlForGrouping,
} from "./url";

describe("URL Utilities", () => {
	it("getSafeUrl: http/httpsから始まる正しいURLのみをパースすること", () => {
		expect(getSafeUrl("https://example.com/path"))?.toBeInstanceOf(URL);
		expect(getSafeUrl("inbox")).toBeNull();
		expect(getSafeUrl("ftp://example.com")).toBeNull();
	});

	it("normalizeUrlForGrouping: プロトコル、www、末尾のスラッシュを削除すること", () => {
		expect(normalizeUrlForGrouping("https://www.example.com/path/")).toBe(
			"example.com/path",
		);
		expect(normalizeUrlForGrouping("http://example.com")).toBe("example.com");
	});

	it("normalizeUrl: 指定スコープに応じて正しく正規化すること", () => {
		const url = "https://www.example.com/path?q=1";
		expect(normalizeUrl(url, "domain")).toBe("example.com");
		expect(normalizeUrl(url, "exact")).toBe("example.com/path?q=1");
		// 特殊パターン(inbox等)のフォールバック検証
		expect(normalizeUrl("inbox", "exact")).toBe("inbox");
	});

	it("getScopeUrls: domainとexactの両スコープのURLオブジェクトを返すこと", () => {
		const res = getScopeUrls("https://www.sitecue.app/notes/");
		expect(res).toEqual({
			domain: "sitecue.app",
			exact: "sitecue.app/notes",
		});
	});
});

describe("buildNoteContextHref", () => {
	it("generates correct URL for inbox scope", () => {
		const href = buildNoteContextHref({ id: "note-1", scope: "inbox" });
		expect(href).toBe("/notes?view=inbox&noteId=note-1");
	});

	it("generates correct URL with exact=domain for domain scope", () => {
		const href = buildNoteContextHref({
			id: "note-2",
			scope: "domain",
			url_pattern: "127.0.0.1:3000",
		});
		expect(href).toBe(
			"/notes?domain=127.0.0.1%3A3000&view=domains&exact=domain&noteId=note-2",
		);
	});

	it("generates correct URL with exact parameter for exact page scope", () => {
		const href = buildNoteContextHref({
			id: "note-3",
			scope: "exact",
			url_pattern: "example.com/blog/1",
		});
		expect(href).toBe(
			`/notes?domain=example.com&view=domains&exact=${encodeURIComponent("example.com/blog/1")}&noteId=note-3`,
		);
	});

	it("extracts domain correctly when url_pattern includes http protocol", () => {
		const href = buildNoteContextHref({
			id: "note-4",
			scope: "exact",
			url_pattern: "https://qiita.com/stock-feed",
		});
		expect(href).toBe(
			`/notes?domain=qiita.com&view=domains&exact=${encodeURIComponent("https://qiita.com/stock-feed")}&noteId=note-4`,
		);
	});

	it("generates studio URL when scope is draft and draft_id is provided", () => {
		const href = buildNoteContextHref({
			id: "note-5",
			scope: "draft",
			draft_id: "draft-abc-123",
			url_pattern: "draft",
		});
		expect(href).toBe("/studio/draft-abc-123");
	});

	it("generates studio URL when scope is draft and url_pattern has sitecue://draft/ prefix", () => {
		const href = buildNoteContextHref({
			id: "note-6",
			scope: "draft",
			draft_id: null,
			url_pattern: "sitecue://draft/draft-xyz-789",
		});
		expect(href).toBe("/studio/draft-xyz-789");
	});

	it("rescues corrupted exact note with url_pattern === 'domain'", () => {
		const href = buildNoteContextHref({
			id: "note-corrupted",
			scope: "exact",
			url_pattern: "domain",
		});
		expect(href).toBe("/notes?q=domain&noteId=note-corrupted");
	});
});
