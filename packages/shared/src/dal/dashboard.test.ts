import { describe, expect, it, vi } from "vitest";
import {
	fetchDashboardActivityData,
	fetchDashboardOverviewData,
	getTodayFocusMeta,
} from "./dashboard";

describe("getTodayFocusMeta", () => {
	it("指定した日時からJST基準の今日の日付メタ情報を正しく算出すること", () => {
		const fixedDate = new Date("2026-08-11T03:00:00Z"); // JST 12:00
		const meta = getTodayFocusMeta(fixedDate);

		expect(meta.todayStr).toBe("2026-08-11");
		expect(meta.currentYear).toBe("2026");
		expect(meta.currentMonth).toBe("08");
		expect(meta.dayNumStr).toBe("11");
		expect(meta.startOfDay).toBe("2026-08-11T00:00:00+09:00");
	});
});

describe("fetchDashboardActivityData & fetchDashboardOverviewData DAL", () => {
	it("7日間のデータが5件以上ある場合、個別COUNTクエリや追加フェッチなしでインメモリからtodayTotalとrecentItemsを算出し、scope=draftを除外すること", async () => {
		const now = new Date();
		const mockNotes7d = Array.from({ length: 6 }, (_, i) => ({
			id: `n-${i}`,
			content: `Note ${i}`,
			is_resolved: false,
			scope: "inbox",
			url_pattern: "inbox",
			created_at: new Date(now.getTime() - i * 1000).toISOString(),
			note_type: "info",
		}));

		const mockDrafts7d = Array.from({ length: 6 }, (_, i) => ({
			id: `d-${i}`,
			title: `Draft ${i}`,
			content: `Content ${i}`,
			created_at: new Date(now.getTime() - i * 1000).toISOString(),
		}));

		const mockNeq = vi.fn().mockReturnValue({
			gte: vi.fn().mockReturnValue({
				order: vi.fn().mockResolvedValue({
					data: mockNotes7d,
					error: null,
				}),
			}),
		});

		const mockFrom = vi.fn().mockImplementation((table) => {
			if (table === "sitecue_notes") {
				return {
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							neq: mockNeq,
						}),
					}),
				};
			}
			if (table === "sitecue_drafts") {
				return {
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							gte: vi.fn().mockReturnValue({
								order: vi.fn().mockResolvedValue({
									data: mockDrafts7d,
									error: null,
								}),
							}),
						}),
					}),
				};
			}
			return {};
		});

		const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
		const mockSupabase = {
			from: mockFrom,
			rpc: mockRpc,
		};

		const result = await fetchDashboardActivityData(
			mockSupabase as unknown as Parameters<
				typeof fetchDashboardActivityData
			>[0],
			"user-123",
		);

		expect(mockNeq).toHaveBeenCalledWith("scope", "draft");
		expect(result.notes7d.length).toBe(6);
		expect(result.recentNotes.length).toBe(5);
		expect(result.recentNotes[0].id).toBe("n-0");
		expect(result.recentDrafts.length).toBe(5);
		expect(result.recentDrafts[0].id).toBe("d-0");
		expect(result.todayTotal).toBe(12);
		expect(mockRpc).not.toHaveBeenCalled();
	});

	it("7日間のデータが5件未満の場合、フォールバックとして全期間の直近5件を取得し、そこでもscope=draftを除外すること", async () => {
		const mockNotes7d = [
			{
				id: "n-0",
				content: "Note 0",
				is_resolved: false,
				scope: "inbox",
				url_pattern: "inbox",
				created_at: new Date().toISOString(),
				note_type: "info",
			},
		];

		const mockFallbackNotes = Array.from({ length: 5 }, (_, i) => ({
			id: `fb-n-${i}`,
			content: `Fallback Note ${i}`,
			is_resolved: false,
			scope: "inbox",
			url_pattern: "inbox",
			created_at: new Date(Date.now() - (i + 10) * 86400000).toISOString(),
		}));

		const mockNeq = vi.fn().mockReturnValue({
			gte: vi.fn().mockReturnValue({
				order: vi.fn().mockResolvedValue({
					data: mockNotes7d,
					error: null,
				}),
			}),
			order: vi.fn().mockReturnValue({
				limit: vi.fn().mockResolvedValue({
					data: mockFallbackNotes,
					error: null,
				}),
			}),
		});

		const mockFrom = vi.fn().mockImplementation((table) => {
			if (table === "sitecue_notes") {
				return {
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							neq: mockNeq,
						}),
					}),
				};
			}
			if (table === "sitecue_drafts") {
				return {
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							gte: vi.fn().mockReturnValue({
								order: vi.fn().mockResolvedValue({
									data: [],
									error: null,
								}),
							}),
							order: vi.fn().mockReturnValue({
								limit: vi.fn().mockResolvedValue({
									data: [],
									error: null,
								}),
							}),
						}),
					}),
				};
			}
			return {};
		});

		const mockSupabase = {
			from: mockFrom,
			rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
		};

		const result = await fetchDashboardOverviewData(
			mockSupabase as unknown as Parameters<
				typeof fetchDashboardOverviewData
			>[0],
			"user-123",
		);

		expect(mockNeq).toHaveBeenCalledTimes(2);
		expect(result.notes7d.length).toBe(1);
		expect(result.recentNotes.length).toBe(5);
		expect(result.recentNotes[0].id).toBe("fb-n-0");
		expect(result.todayTotal).toBe(1);
	});
});
