import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchModal } from "./SearchModal";

// Mock Next.js navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: mockPush }),
}));

// Mock useSearchNotes hook
const mockSearchNotes = vi.fn();
const mockFetchNoteContents = vi.fn();
vi.mock("@/hooks/useNotesQuery", () => ({
	useSearchNotes: (q: string) => mockSearchNotes(q),
	useFetchNoteContents: () => ({ mutate: mockFetchNoteContents }),
}));

const mockFetchDiaries = vi.fn(() => ({ data: [] as unknown[] }));
vi.mock("@/hooks/useDiariesQuery", () => ({
	useFetchDiaries: () => mockFetchDiaries(),
	useAppendDiary: () => ({ mutate: vi.fn() }),
	useUpdateDiary: () => ({ mutate: vi.fn() }),
}));

describe("SearchModal Context Jump", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should navigate to exact domain and set noteId when an exact note is clicked", async () => {
		const user = userEvent.setup();

		mockSearchNotes.mockReturnValue({
			data: {
				notes: [
					{
						id: "note-123",
						content: "Test Note Content",
						scope: "exact",
						url_pattern: "https://example.com/path",
						note_type: "info",
						created_at: new Date().toISOString(),
					},
				],
				drafts: [],
			},
			isLoading: false,
		});

		const queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		});
		render(
			<QueryClientProvider client={queryClient}>
				<SearchModal isOpen={true} onClose={vi.fn()} />
			</QueryClientProvider>,
		);

		const input = screen.getByPlaceholderText(/search notes/i);
		await user.type(input, "Test");
		await user.keyboard("{Enter}");

		const noteResult = await screen.findByText("Test Note Content");
		expect(screen.getByText(/Page • info/i)).toBeInTheDocument();
		await user.click(noteResult);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith(
				`/notes?domain=example.com&view=domains&exact=${encodeURIComponent("https://example.com/path")}&noteId=note-123`,
			);
		});
	});

	it("should navigate with exact=domain when a domain scope note is clicked", async () => {
		const user = userEvent.setup();

		mockSearchNotes.mockReturnValue({
			data: {
				notes: [
					{
						id: "note-domain-1",
						content: "Domain Note Content",
						scope: "domain",
						url_pattern: "github.com",
						note_type: "idea",
						created_at: new Date().toISOString(),
					},
				],
				drafts: [],
			},
			isLoading: false,
		});

		const queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		});
		render(
			<QueryClientProvider client={queryClient}>
				<SearchModal isOpen={true} onClose={vi.fn()} />
			</QueryClientProvider>,
		);

		const input = screen.getByPlaceholderText(/search notes/i);
		await user.type(input, "Domain");
		await user.keyboard("{Enter}");

		const noteResult = await screen.findByText("Domain Note Content");
		expect(screen.getByText(/Domain • idea/i)).toBeInTheDocument();
		await user.click(noteResult);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith(
				"/notes?domain=github.com&view=domains&exact=domain&noteId=note-domain-1",
			);
		});
	});

	it("should navigate to inbox for inbox scope notes and exclude inbox from Domains list", async () => {
		const user = userEvent.setup();

		mockSearchNotes.mockReturnValue({
			data: {
				notes: [
					{
						id: "note-inbox",
						content: "Inbox Note",
						scope: "inbox",
						url_pattern: "inbox",
						note_type: "info",
						created_at: new Date().toISOString(),
					},
				],
				drafts: [],
			},
			isLoading: false,
		});

		const queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		});
		render(
			<QueryClientProvider client={queryClient}>
				<SearchModal isOpen={true} onClose={vi.fn()} />
			</QueryClientProvider>,
		);

		const input = screen.getByPlaceholderText(/search notes/i);
		await user.type(input, "Inbox");
		await user.keyboard("{Enter}");

		const noteResult = await screen.findByText("Inbox Note");
		expect(screen.queryByText("Domains")).not.toBeInTheDocument();
		await user.click(noteResult);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith(
				"/notes?view=inbox&noteId=note-inbox",
			);
		});
	});

	it("should display 'Studio Review' label and navigate to /studio/[draftId] when a draft scope review note is clicked", async () => {
		const user = userEvent.setup();

		mockSearchNotes.mockReturnValue({
			data: {
				notes: [
					{
						id: "note-review-1",
						content: "Self review comment",
						scope: "draft",
						url_pattern: "sitecue://draft/draft-999",
						draft_id: "draft-999",
						note_type: "alert",
						created_at: new Date().toISOString(),
					},
				],
				drafts: [],
			},
			isLoading: false,
		});

		const queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		});
		render(
			<QueryClientProvider client={queryClient}>
				<SearchModal isOpen={true} onClose={vi.fn()} />
			</QueryClientProvider>,
		);

		const input = screen.getByPlaceholderText(/search notes/i);
		await user.type(input, "review");
		await user.keyboard("{Enter}");

		const noteResult = await screen.findByText("Self review comment");
		expect(screen.getByText(/Studio Review • alert/i)).toBeInTheDocument();
		expect(screen.getByText("Review note in Studio")).toBeInTheDocument();
		expect(screen.queryByText("Domains")).not.toBeInTheDocument();

		await user.click(noteResult);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith("/studio/draft-999");
		});
	});

	it("should not trigger search on input change, only on submit", async () => {
		const _user = userEvent.setup();
		mockSearchNotes.mockReturnValue({
			data: { notes: [], drafts: [] },
			isLoading: false,
		});

		const queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		});
		render(
			<QueryClientProvider client={queryClient}>
				<SearchModal isOpen={true} onClose={vi.fn()} />
			</QueryClientProvider>,
		);

		const input = screen.getByPlaceholderText(/search notes/i);
		fireEvent.change(input, { target: { value: "Test" } });

		expect(mockSearchNotes).not.toHaveBeenCalledWith("Test");

		fireEvent.keyDown(input, { key: "Enter" });

		await waitFor(() => {
			expect(mockSearchNotes).toHaveBeenCalledWith("Test");
		});
	});

	it("should clear input and results when clear button is clicked", async () => {
		mockSearchNotes.mockImplementation((q) => {
			if (q === "Test") {
				return {
					data: {
						notes: [
							{
								id: "1",
								content: "Test Result",
								url_pattern: "test.com",
								scope: "domain",
								note_type: "info",
								created_at: new Date().toISOString(),
							},
						],
						drafts: [],
					},
					isLoading: false,
				};
			}
			return { data: { notes: [], drafts: [] }, isLoading: false };
		});

		const queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		});
		render(
			<QueryClientProvider client={queryClient}>
				<SearchModal isOpen={true} onClose={vi.fn()} />
			</QueryClientProvider>,
		);

		const input = screen.getByPlaceholderText("Search notes...");

		fireEvent.change(input, { target: { value: "Test" } });
		fireEvent.keyDown(input, { key: "Enter" });

		expect(await screen.findByText("Test Result")).toBeInTheDocument();

		const clearButton = screen.getByRole("button", { name: /clear search/i });
		fireEvent.click(clearButton);

		expect(input).toHaveValue("");
		expect(screen.queryByText("Test Result")).not.toBeInTheDocument();
		expect(
			screen.getByText(
				"Type and press Enter to search your notes across domains",
			),
		).toBeInTheDocument();
	});

	it("should render drafts and navigate on click", async () => {
		const user = userEvent.setup();
		const mockDrafts = [
			{
				id: "draft-1",
				title: "My Secret Draft",
				content: "Writing something...",
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				user_id: "user-1",
				metadata: null,
				template_id: null,
				tags: [],
			},
		];

		mockSearchNotes.mockReturnValue({
			data: { notes: [], drafts: mockDrafts },
			isLoading: false,
		});

		const queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		});
		render(
			<QueryClientProvider client={queryClient}>
				<SearchModal isOpen={true} onClose={vi.fn()} />
			</QueryClientProvider>,
		);

		const input = screen.getByPlaceholderText(/search notes/i);
		await user.type(input, "Secret");
		await user.keyboard("{Enter}");

		await waitFor(() => {
			expect(screen.getByText("Drafts")).toBeInTheDocument();
			expect(screen.getByText("My Secret Draft")).toBeInTheDocument();
		});

		const draftResult = screen.getByText("My Secret Draft");
		await user.click(draftResult);

		expect(mockPush).toHaveBeenCalledWith("/notes?view=drafts&draftId=draft-1");
	});

	it("should cancel noise in pages when domain matches", async () => {
		const user = userEvent.setup();
		const mockNotes = [
			{
				id: "1",
				url_pattern: "example.com",
				scope: "domain",
				content: "domain note",
				created_at: new Date().toISOString(),
			},
			{
				id: "2",
				url_pattern: "https://example.com/page-1",
				scope: "exact",
				content: "page note",
				created_at: new Date().toISOString(),
			},
		];

		mockSearchNotes.mockReturnValue({
			data: { notes: mockNotes, drafts: [] },
			isLoading: false,
		});

		const queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		});
		render(
			<QueryClientProvider client={queryClient}>
				<SearchModal isOpen={true} onClose={vi.fn()} />
			</QueryClientProvider>,
		);

		const input = screen.getByPlaceholderText(/search notes/i);
		await new Promise((resolve) => setTimeout(resolve, 150));
		await user.type(input, "example");
		await user.keyboard("{Enter}");

		await waitFor(() => {
			expect(screen.getByText("Domains")).toBeInTheDocument();
			expect(screen.getByText("example.com")).toBeInTheDocument();
			expect(
				screen.queryByText("https://example.com/page-1"),
			).not.toBeInTheDocument();
		});
	});

	it("グローバル検索で日記データが検索され、クリック時に正しいコンテキストパラメータにジャンプすること", async () => {
		const user = userEvent.setup();
		mockSearchNotes.mockReturnValue({
			data: { notes: [], drafts: [] },
			isLoading: false,
		});
		mockFetchDiaries.mockReturnValue({
			data: [
				{
					user_id: "user-1",
					date: "2026-06-27",
					content: "Diaries integrated test text line\nSecond line",
					topics: ["test"],
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				},
			],
		});

		const queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		});
		render(
			<QueryClientProvider client={queryClient}>
				<SearchModal isOpen={true} onClose={vi.fn()} />
			</QueryClientProvider>,
		);

		const input = screen.getByPlaceholderText(/search notes/i);
		await new Promise((resolve) => setTimeout(resolve, 150));
		await user.type(input, "integrated");
		await user.keyboard("{Enter}");

		await waitFor(() => {
			expect(screen.getByText("Diaries")).toBeInTheDocument();
			expect(
				screen.getByText("Diaries integrated test text line"),
			).toBeInTheDocument();
		});

		const diaryResult = screen.getByText("Diaries integrated test text line");
		await user.click(diaryResult);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith(
				"/notes?view=diaries&year=2026&month=06&date=2026-06-27",
			);
		});
	});
});
