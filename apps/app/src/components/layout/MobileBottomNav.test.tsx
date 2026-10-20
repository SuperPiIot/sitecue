import { fireEvent, render, screen } from "@testing-library/react";
import { usePathname, useSearchParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLayoutStore } from "@/store/useLayoutStore";
import { MobileBottomNav } from "./MobileBottomNav";

vi.mock("next/navigation", () => ({
	usePathname: vi.fn(),
	useSearchParams: vi.fn(),
}));

// Mock UserMenu to avoid Supabase calls and network requests
vi.mock("@/app/(dashboard)/_components/UserMenu", () => ({
	UserMenu: () => <div data-testid="user-menu" />,
}));

describe("MobileBottomNav", () => {
	const mockOnSearchOpen = vi.fn();

	const mockSearchParams = (params: Record<string, string>) => {
		vi.mocked(useSearchParams).mockReturnValue({
			get: (key: string) => params[key] || null,
		} as unknown as ReturnType<typeof useSearchParams>);
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("通常時はナビゲーションとUserMenuが表示されること", () => {
		vi.mocked(usePathname).mockReturnValue("/notes");
		mockSearchParams({});

		render(<MobileBottomNav onSearchOpen={mockOnSearchOpen} />);
		expect(screen.getByRole("navigation")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Notes" })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "New Note" }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
		expect(screen.getByTestId("user-menu")).toBeInTheDocument();
	});

	it("詳細ペインが開いている時（noteIdが存在）は表示されないこと", () => {
		vi.mocked(usePathname).mockReturnValue("/notes");
		mockSearchParams({ noteId: "test-id" });

		const { container } = render(
			<MobileBottomNav onSearchOpen={mockOnSearchOpen} />,
		);
		expect(container.firstChild).toBeNull();
	});

	it("現在のパスが /studio 始まりの時は表示されないこと", () => {
		vi.mocked(usePathname).mockReturnValue("/studio/some-draft-id");
		mockSearchParams({});

		const { container } = render(
			<MobileBottomNav onSearchOpen={mockOnSearchOpen} />,
		);
		expect(container.firstChild).toBeNull();
	});

	it("LogoボタンがクリックされたらインメモリでglobalNewModalを開くこと", () => {
		useLayoutStore.getState().closeGlobalNewModal();
		vi.mocked(usePathname).mockReturnValue("/notes");
		mockSearchParams({});

		render(<MobileBottomNav onSearchOpen={mockOnSearchOpen} />);

		const newNoteBtn = screen.getByRole("button", { name: "New Note" });
		fireEvent.click(newNoteBtn);

		expect(useLayoutStore.getState().globalNewModal.isOpen).toBe(true);
		expect(useLayoutStore.getState().globalNewModal.mode).toBe("gate");
	});
});
