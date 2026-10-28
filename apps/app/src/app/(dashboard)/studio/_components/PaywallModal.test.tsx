import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PaywallModal from "./PaywallModal";

const mockGetUser = vi.fn().mockResolvedValue({
	data: { user: { id: "user_test_123", email: "user@example.com" } },
});

vi.mock("@/utils/supabase/client", () => ({
	createClient: vi.fn(() => ({
		auth: {
			getUser: mockGetUser,
		},
	})),
}));

describe("PaywallModal", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL_MONTHLY =
			"https://sandbox.polar.sh/checkout/monthly-test";
		process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL_YEARLY =
			"https://sandbox.polar.sh/checkout/yearly-test";
	});

	it("renders AI limit modal for free plan by default", async () => {
		render(<PaywallModal isOpen={true} onClose={vi.fn()} plan="free" />);
		expect(screen.getByText("Monthly Generation Limit")).toBeInTheDocument();
		expect(
			screen.getByText(/You've used all your AI generations/),
		).toBeInTheDocument();
		expect(screen.getByText(/Monthly Plan/)).toBeInTheDocument();
		expect(screen.getByText(/Yearly Plan/)).toBeInTheDocument();

		await waitFor(() => {
			expect(mockGetUser).toHaveBeenCalled();
		});
	});

	it("renders Note limit modal when limitType is 'notes'", async () => {
		render(<PaywallModal isOpen={true} onClose={vi.fn()} limitType="notes" />);
		expect(screen.getByText("Storage Limit Reached")).toBeInTheDocument();
		expect(
			screen.getByText(/You've reached the free limit \(500 notes\)/),
		).toBeInTheDocument();

		await waitFor(() => {
			expect(mockGetUser).toHaveBeenCalled();
		});
	});

	it("renders Draft limit modal when limitType is 'drafts'", async () => {
		render(<PaywallModal isOpen={true} onClose={vi.fn()} limitType="drafts" />);
		expect(screen.getByText("Draft Limit Reached")).toBeInTheDocument();
		expect(
			screen.getByText(/Draft storage limit reached \(50\/50\)/),
		).toBeInTheDocument();

		await waitFor(() => {
			expect(mockGetUser).toHaveBeenCalled();
		});
	});

	it("opens checkout URL with reference_id and customer_email when clicking plan button", async () => {
		const windowOpenSpy = vi
			.spyOn(window, "open")
			.mockImplementation(() => null);
		const onClose = vi.fn();
		render(<PaywallModal isOpen={true} onClose={onClose} plan="free" />);

		await waitFor(() => {
			expect(mockGetUser).toHaveBeenCalled();
		});

		const monthlyBtn = screen.getByText(/Monthly Plan/);
		fireEvent.click(monthlyBtn);

		expect(windowOpenSpy).toHaveBeenCalledWith(
			expect.stringMatching(
				/https:\/\/sandbox\.polar\.sh\/checkout\/monthly-test\?reference_id=user_test_123&customer_email=user%40example\.com/,
			),
			"_blank",
			"noopener,noreferrer",
		);
		expect(onClose).toHaveBeenCalled();
		windowOpenSpy.mockRestore();
	});
});
