import "@testing-library/jest-dom";
import { vi } from "vitest";

// 環境変数のデフォルトモック
const env = import.meta.env as unknown as Record<string, string>;
env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL || "https://example.supabase.co";
env.VITE_SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || "dummy-anon-key";

// Chrome APIのグローバルモック
vi.stubGlobal("chrome", {
	runtime: {
		sendMessage: vi.fn(),
		lastError: undefined,
	},
	storage: {
		local: {
			get: vi.fn().mockResolvedValue({}),
			set: vi.fn().mockResolvedValue(undefined),
			remove: vi.fn().mockResolvedValue(undefined),
		},
	},
	tabs: {
		query: vi.fn(),
		get: vi.fn(),
		onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
		onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
	},
	windows: {
		getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
	},
	identity: {
		getRedirectURL: vi.fn().mockReturnValue("https://app.chromiumapp.org/"),
		launchWebAuthFlow: vi.fn(),
	},
	sidePanel: {
		setPanelBehavior: vi.fn().mockResolvedValue(undefined),
	},
});

// Supabaseのグローバルモック
vi.mock("./supabaseClient", () => ({
	supabase: {
		auth: {
			onAuthStateChange: vi.fn(() => ({
				data: { subscription: { unsubscribe: vi.fn() } },
			})),
			getSession: vi
				.fn()
				.mockResolvedValue({ data: { session: null }, error: null }),
		},
		from: vi.fn().mockReturnValue({
			select: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			or: vi.fn().mockReturnThis(),
			maybeSingle: vi.fn().mockResolvedValue({ data: null }),
			upsert: vi.fn().mockResolvedValue({ error: null }),
			delete: vi.fn().mockResolvedValue({ error: null }),
		}),
	},
	localClient: {
		from: vi.fn().mockReturnValue({
			select: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			or: vi.fn().mockReturnThis(),
			maybeSingle: vi.fn().mockResolvedValue({ data: null }),
			upsert: vi.fn().mockResolvedValue({ error: null }),
			delete: vi.fn().mockResolvedValue({ error: null }),
		}),
	},
}));

// document.execCommand & document.queryCommandSupported mock for happy-dom
if (typeof document !== "undefined") {
	document.queryCommandSupported = vi.fn().mockReturnValue(true);
	document.execCommand = vi
		.fn()
		.mockImplementation(
			(command: string, _showUI?: boolean, value?: string) => {
				const active = document.activeElement as
					| HTMLTextAreaElement
					| HTMLInputElement
					| null;
				if (
					!active ||
					(active.tagName !== "TEXTAREA" && active.tagName !== "INPUT")
				) {
					return false;
				}
				const start = active.selectionStart ?? 0;
				const end = active.selectionEnd ?? 0;
				const currentVal = active.value;

				if (command === "insertText" && typeof value === "string") {
					active.value =
						currentVal.slice(0, start) + value + currentVal.slice(end);
					active.selectionStart = start + value.length;
					active.selectionEnd = active.selectionStart;
					active.dispatchEvent(new Event("input", { bubbles: true }));
					return true;
				}
				if (command === "delete") {
					active.value = currentVal.slice(0, start) + currentVal.slice(end);
					active.selectionStart = start;
					active.selectionEnd = start;
					active.dispatchEvent(new Event("input", { bubbles: true }));
					return true;
				}
				return false;
			},
		);
}

if (
	typeof HTMLTextAreaElement !== "undefined" &&
	!HTMLTextAreaElement.prototype.setRangeText
) {
	HTMLTextAreaElement.prototype.setRangeText = function (
		replacement: string,
		start?: number,
		end?: number,
	) {
		const s = start !== undefined ? start : this.selectionStart;
		const e = end !== undefined ? end : this.selectionEnd;
		this.value = this.value.slice(0, s) + replacement + this.value.slice(e);
		this.selectionStart = s + replacement.length;
		this.selectionEnd = s + replacement.length;
	};
}
