import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LaunchpadPage from "./page";

const mockActivityData = {
	todayTotal: 3,
	todayStr: "2026-08-11",
	monthYearStr: "AUG 2026",
	dayNumStr: "11",
	weekdayStr: "TUESDAY",
	currentYear: "2026",
	currentMonth: "08",
	startOfDay: "2026-08-11T00:00:00+09:00",
	noteCount7d: 5,
	draftCount7d: 2,
	recentNotes: [
		{
			id: "n-1",
			content: "Test Note 1",
			is_resolved: false,
			scope: "inbox" as const,
			url_pattern: "inbox",
			created_at: "2026-08-11T10:00:00Z",
		},
	],
	recentDrafts: [],
	notes7d: [],
	drafts7d: [],
};

const mockDomainsData = [
	{
		domain: "example.com",
		total_count: 3,
		domain_notes: [
			{ id: "dn-1", content: "Domain Note 1", is_resolved: false },
		],
		top_pages: [],
	},
];

let isMockLoading = false;

vi.mock("@/hooks/useDashboardQuery", () => ({
	DASHBOARD_QUERY_KEY: ["dashboard"],
	useFetchDashboardActivity: () => {
		if (isMockLoading) {
			return { data: undefined, isLoading: true };
		}
		return { data: mockActivityData, isLoading: false };
	},
	useFetchDashboardDomains: () => {
		if (isMockLoading) {
			return { data: undefined, isLoading: true };
		}
		return { data: mockDomainsData, isLoading: false };
	},
	useFetchDashboardData: () => {
		if (isMockLoading) {
			return { data: undefined, isLoading: true };
		}
		return {
			data: { ...mockActivityData, domainActivities: mockDomainsData },
			isLoading: false,
		};
	},
}));

vi.mock("next/navigation", () => ({
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => "/",
}));

function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});
}

function TestWrapper({ children }: { children: ReactNode }) {
	const queryClient = createTestQueryClient();
	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}

describe("LaunchpadPage (/)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		isMockLoading = false;
	});

	it("Cold Start時（データ読み込み中）であってもUIシェル（Today's Focusカレンダー・日記追記ボタン・セクション見出し等）が0msで常時レンダリングされること", () => {
		isMockLoading = true;

		render(<LaunchpadPage />, { wrapper: TestWrapper });

		expect(screen.getByText("Today's Focus")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /\+ append to today's diary/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Domain Activity" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Activity Log" }),
		).toBeInTheDocument();
	});

	it("データフェッチ完了後、各データスロットのコンテンツ（DomainActivity、Weekly Progress等）が正常描画されること", async () => {
		render(<LaunchpadPage />, { wrapper: TestWrapper });

		await waitFor(() => {
			expect(screen.getByText("example.com")).toBeInTheDocument();
			expect(screen.getByText("3")).toBeInTheDocument(); // todayTotal
		});
	});
});
