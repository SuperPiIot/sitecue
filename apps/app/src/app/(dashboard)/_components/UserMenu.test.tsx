import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserMenu } from "./UserMenu";

// Supabase クライアントのモック
const mockGetUser = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue({});
vi.mock("@/utils/supabase/client", () => ({
	createClient: () => ({
		auth: {
			getUser: mockGetUser,
			signOut: mockSignOut,
		},
	}),
}));

// DAL のモック
const mockFetchOrResetUserProfile = vi.fn();
vi.mock("@sitecue/shared", () => ({
	SHARED_LIMITS: {
		AI_LIMIT: {
			MAX_FREE: 3,
			MAX_PRO: 100,
			WARNING_THRESHOLD_FREE: 3,
			WARNING_THRESHOLD_PRO: 90,
		},
		NOTES_LIMIT: {
			MAX_FREE: 500,
			WARNING_THRESHOLD: 450,
		},
		DRAFTS_LIMIT: {
			MAX_FREE: 50,
			WARNING_THRESHOLD: 45,
		},
	},
	fetchOrResetUserProfile: (...args: unknown[]) =>
		mockFetchOrResetUserProfile(...args),
}));

// フックのモック
vi.mock("@/hooks/useNotesQuery", () => ({
	useFetchNotes: () => ({ data: [] }),
}));
vi.mock("@/hooks/useDraftsQuery", () => ({
	useFetchDrafts: () => ({ data: [] }),
}));

// ルーターのモック
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		refresh: mockRefresh,
	}),
}));

// Zustand ストアのモック状態管理
let currentStoreState = {
	aiUsageCount: 0,
	plan: "free" as "free" | "pro",
	setUserData: vi.fn((count: number, plan: "free" | "pro") => {
		currentStoreState.aiUsageCount = count;
		currentStoreState.plan = plan;
	}),
	openPaywall: vi.fn(),
};

vi.mock("@/store/useUserStore", () => ({
	useUserStore: () => currentStoreState,
}));

describe("UserMenu", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		currentStoreState = {
			aiUsageCount: 0,
			plan: "free",
			setUserData: vi.fn((count: number, plan: "free" | "pro") => {
				currentStoreState.aiUsageCount = count;
				currentStoreState.plan = plan;
			}),
			openPaywall: vi.fn(),
		};
		mockGetUser.mockResolvedValue({
			data: {
				user: {
					id: "test-user-id",
					email: "test@sitecue.app",
					user_metadata: {},
				},
			},
		});
		mockFetchOrResetUserProfile.mockResolvedValue({
			ai_usage_count: 0,
			plan: "free",
		});
	});

	afterEach(() => {
		cleanup();
	});

	it("Free プランのとき、Upgrade to Pro が表示され、Manage Subscription は表示されないこと", async () => {
		currentStoreState.plan = "free";
		render(<UserMenu />);

		// ユーザー情報ロード待ち
		await waitFor(() => {
			expect(screen.getByRole("button", { name: "User menu" })).toBeDefined();
		});

		// メニューを開く
		fireEvent.click(screen.getByRole("button", { name: "User menu" }));

		expect(screen.getByText("Upgrade to Pro")).toBeDefined();
		expect(screen.queryByText("Pro Plan Active")).toBeNull();
		expect(screen.queryByText("Manage Subscription")).toBeNull();
	});

	it("Pro プランのとき、Pro Plan Active と Manage Subscription リンクが表示され、正しい属性を持つこと", async () => {
		currentStoreState.plan = "pro";
		mockFetchOrResetUserProfile.mockResolvedValue({
			ai_usage_count: 5,
			plan: "pro",
		});

		render(<UserMenu />);

		await waitFor(() => {
			expect(screen.getByRole("button", { name: "User menu" })).toBeDefined();
		});

		fireEvent.click(screen.getByRole("button", { name: "User menu" }));

		expect(screen.getByText("Pro Plan Active")).toBeDefined();
		expect(screen.queryByText("Upgrade to Pro")).toBeNull();

		const portalLink = screen.getByRole("link", {
			name: /Manage Subscription/i,
		});
		expect(portalLink).toBeDefined();
		expect(portalLink.getAttribute("href")).toBe(
			"https://polar.sh/sitecue/portal",
		);
		expect(portalLink.getAttribute("target")).toBe("_blank");
		expect(portalLink.getAttribute("rel")).toBe("noopener noreferrer");
	});
});
