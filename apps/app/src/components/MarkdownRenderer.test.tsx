import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MarkdownRenderer from "./MarkdownRenderer";

// InlineCopyButton のモック
vi.mock("@/components/ui/inline-copy-button", () => ({
	InlineCopyButton: ({ text }: { text: string }) => (
		<button
			type="button"
			data-testid="copy-button"
			title="Copy to clipboard"
			aria-label={`Copy ${text}`}
		>
			Copy
		</button>
	),
}));

describe("MarkdownRenderer", () => {
	it("renders a code block and toggles wrapping", async () => {
		const content = "```javascript\nconst a = 1;\n```";
		render(<MarkdownRenderer content={content} />);

		const wrapButton = screen.getByTitle("Wrap text");
		const pre = wrapButton.closest("div")?.nextElementSibling as HTMLPreElement;
		expect(pre).toBeInTheDocument();
		expect(pre).not.toHaveClass("whitespace-pre-wrap");

		await act(async () => {
			fireEvent.click(wrapButton);
		});

		expect(pre).toHaveClass("whitespace-pre-wrap");
		expect(pre).toHaveClass("break-all");
		expect(wrapButton).toHaveAttribute("title", "Disable wrap");

		await act(async () => {
			fireEvent.click(wrapButton);
		});

		expect(pre).not.toHaveClass("whitespace-pre-wrap");
		expect(wrapButton).toHaveAttribute("title", "Wrap text");
	});

	it("shows wrap and copy buttons on hover (group hover simulation)", async () => {
		const content = "```javascript\nconst a = 1;\n```";
		render(<MarkdownRenderer content={content} />);

		const wrapButton = screen.getByTitle("Wrap text");
		const _copyButton = screen.getByTestId("copy-button");

		// The buttons have opacity-100 pointer-fine:opacity-0 group-hover-safe:opacity-100
		// In JSDOM, classes are just strings, so we check if they have the correct classes
		const container = wrapButton.closest("div");
		expect(container).toHaveClass("opacity-100");
		expect(container).toHaveClass("group-hover-safe:opacity-100");
	});

	it("プロトコルが省略された外部リンクにhttps://が補完されること", () => {
		render(<MarkdownRenderer content="Check [Google](google.com)" />);
		const link = screen.getByRole("link", { name: /Google/i });
		expect(link).toHaveAttribute("href", "https://google.com");
	});
});
