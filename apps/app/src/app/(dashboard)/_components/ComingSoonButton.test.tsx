import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComingSoonButton } from "./ComingSoonButton";

const mockOpenPaywall = vi.fn();

vi.mock("@/store/useUserStore", () => ({
	useUserStore: vi.fn((selector) => {
		const state = { openPaywall: mockOpenPaywall };
		return selector(state);
	}),
}));

describe("ComingSoonButton", () => {
	it("renders text and triggers openPaywall on click", () => {
		render(<ComingSoonButton text="Upgrade" />);
		const button = screen.getByText("Upgrade");

		expect(button).toBeInTheDocument();

		fireEvent.click(button);
		expect(mockOpenPaywall).toHaveBeenCalledWith("notes");
	});
});
