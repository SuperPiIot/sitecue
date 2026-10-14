import { type NextRequest, NextResponse } from "next/server";

// 環境変数未指定時のフォールバック用正規表現
const FALLBACK_SB_AUTH_COOKIE_REGEX = /^sb-.*-auth-token(\.\d+)?$/;

/**
 * NEXT_PUBLIC_SUPABASE_URL のホスト名先頭（Project Ref）に基づき、
 * 現在のターゲット環境に一致する Supabase Auth Cookie 名かどうかを高速判定する（<0.05ms）。
 * - 例1: http://127.0.0.1:54321 -> projectRef = "127" -> sb-127-auth-token(.0)
 * - 例2: https://abcdefgh.supabase.co -> projectRef = "abcdefgh" -> sb-abcdefgh-auth-token(.0)
 */
export function isMatchingSupabaseAuthCookie(
	cookieName: string,
	supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): boolean {
	if (supabaseUrl) {
		try {
			const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
			if (projectRef) {
				const baseName = `sb-${projectRef}-auth-token`;
				if (cookieName === baseName) return true;
				if (cookieName.startsWith(`${baseName}.`)) {
					const suffix = cookieName.slice(baseName.length + 1);
					return /^\d+$/.test(suffix);
				}
				return false;
			}
		} catch {
			// URLパース失敗時はフォールバック正規表現で判定
		}
	}
	return FALLBACK_SB_AUTH_COOKIE_REGEX.test(cookieName);
}

export async function updateSession(request: NextRequest) {
	// オプトアウト方式: 認証不要な公開ルートをホワイトリストとして定義
	const publicRoutes = ["/login", "/auth/callback", "/pricing"];
	const isPublicRoute =
		publicRoutes.includes(request.nextUrl.pathname) ||
		request.nextUrl.pathname.startsWith("/api/");

	// 認証Cookieの存在確認（環境別Project Ref照合・高速軽量チェック: <0.05ms）
	const hasAuthCookie = request.cookies
		.getAll()
		.some(
			(cookie) =>
				isMatchingSupabaseAuthCookie(cookie.name) && Boolean(cookie.value),
		);

	if (!hasAuthCookie && !isPublicRoute) {
		let baseUrl = request.url;
		const host =
			request.headers.get("x-forwarded-host") || request.headers.get("host");
		if (host) {
			const protocol = request.headers.get("x-forwarded-proto") || "http";
			baseUrl = `${protocol}://${host}`;
		}

		const redirectUrl = new URL("/login", baseUrl);
		if (redirectUrl.hostname === "localhost") {
			redirectUrl.hostname = "127.0.0.1";
		}
		// biome-ignore format: User preference for single line
		redirectUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);

		return NextResponse.redirect(redirectUrl);
	}

	return NextResponse.next({
		request,
	});
}

// 静的アセット等の除外設定
export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	],
};
