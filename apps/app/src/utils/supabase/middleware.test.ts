import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isMatchingSupabaseAuthCookie, updateSession } from "./middleware";

describe("isMatchingSupabaseAuthCookie", () => {
	it("ローカルSupabase URL (127.0.0.1) のとき sb-127-auth-token のみにマッチし、本番用Cookieを弾くこと", () => {
		const localUrl = "http://127.0.0.1:54321";
		expect(isMatchingSupabaseAuthCookie("sb-127-auth-token", localUrl)).toBe(
			true,
		);
		expect(isMatchingSupabaseAuthCookie("sb-127-auth-token.0", localUrl)).toBe(
			true,
		);
		expect(
			isMatchingSupabaseAuthCookie("sb-prodref-auth-token", localUrl),
		).toBe(false);
	});

	it("本番Supabase URL (https://prodref.supabase.co) のとき sb-prodref-auth-token のみにマッチし、ローカル用 sb-127-auth-token を弾くこと", () => {
		const prodUrl = "https://prodref.supabase.co";
		expect(isMatchingSupabaseAuthCookie("sb-prodref-auth-token", prodUrl)).toBe(
			true,
		);
		expect(
			isMatchingSupabaseAuthCookie("sb-prodref-auth-token.1", prodUrl),
		).toBe(true);
		expect(isMatchingSupabaseAuthCookie("sb-127-auth-token", prodUrl)).toBe(
			false,
		);
	});

	it("環境変数が空または未定義の場合はフォールバックとして任意の sb-*-auth-token にマッチすること", () => {
		expect(isMatchingSupabaseAuthCookie("sb-any-auth-token", "")).toBe(true);
		expect(isMatchingSupabaseAuthCookie("sb-any-auth-token.0", undefined)).toBe(
			true,
		);
		expect(isMatchingSupabaseAuthCookie("other-cookie", "")).toBe(false);
	});
});

describe("updateSession Middleware", () => {
	const originalEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;

	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv;
	});

	it("本番環境URL設定時にローカルの sb-127-auth-token Cookieしか存在しない場合、素通りさせず /login へリダイレクトすること", async () => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://prodref.supabase.co";

		const req = new NextRequest("http://127.0.0.1:3000/notes", {
			headers: {
				cookie: "sb-127-auth-token=local-dummy-token",
				host: "127.0.0.1:3000",
			},
		});

		const res = await updateSession(req);

		expect(res.status).toBe(307);
		expect(res.headers.get("location")).toBe(
			"http://127.0.0.1:3000/login?next=%2Fnotes",
		);
	});

	it("現在の環境URLに一致するAuth Cookieが存在する場合はリダイレクトせず通過させること", async () => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://prodref.supabase.co";

		const req = new NextRequest("http://127.0.0.1:3000/", {
			headers: {
				cookie: "sb-prodref-auth-token.0=valid-chunk-token",
				host: "127.0.0.1:3000",
			},
		});

		const res = await updateSession(req);

		expect(res.status).toBe(200);
		expect(res.headers.get("location")).toBeNull();
	});
});
