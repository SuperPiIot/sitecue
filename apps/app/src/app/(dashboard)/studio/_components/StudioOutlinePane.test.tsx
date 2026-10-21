import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StudioOutlinePane, { parseHeadings } from "./StudioOutlinePane";

describe("StudioOutlinePane & parseHeadings", () => {
	const markdownSample = `
# Title 1
Intro text

## Subtitle 1.1
Some content

\`\`\`bash
# Ignored code comment
echo "hello"
\`\`\`

### Deep Section
Final text
`;

	it("Markdownテキストから見出しを正しく抽出し、コードブロック内のコメントは無視すること", () => {
		const headings = parseHeadings(markdownSample);
		expect(headings).toHaveLength(3);
		expect(headings[0]).toMatchObject({ level: 1, text: "Title 1" });
		expect(headings[1]).toMatchObject({ level: 2, text: "Subtitle 1.1" });
		expect(headings[2]).toMatchObject({ level: 3, text: "Deep Section" });
	});

	it("チルダフェンスや異なる長さのフェンス、インラインコード内も正しく無視できること", () => {
		const complexSample = `
# Title

\`\`\`\`markdown
\`\`\`js
# Ignored inner comment
\`\`\`
\`\`\`\`

~~~python
# Ignored python comment
~~~

## Valid Subtitle
\`\`\`inline code\`\`\`
### Another Section
`;
		const headings = parseHeadings(complexSample);
		expect(headings).toHaveLength(3);
		expect(headings[0].text).toBe("Title");
		expect(headings[1].text).toBe("Valid Subtitle");
		expect(headings[2].text).toBe("Another Section");
	});

	it("見出し一覧がレンダリングされ、クリック時にコールバックが発火すること", () => {
		const handleSelect = vi.fn();
		render(
			<StudioOutlinePane
				content={markdownSample}
				onSelectHeading={handleSelect}
			/>,
		);

		expect(screen.getByText("Title 1")).toBeInTheDocument();
		expect(screen.getByText("Subtitle 1.1")).toBeInTheDocument();
		expect(screen.getByText("Deep Section")).toBeInTheDocument();

		fireEvent.click(screen.getByText("Subtitle 1.1"));
		expect(handleSelect).toHaveBeenCalledWith(
			expect.objectContaining({ text: "Subtitle 1.1", level: 2 }),
		);
	});

	it("検索キーワードを入力した際、見出しが絞り込まれること", () => {
		render(
			<StudioOutlinePane content={markdownSample} onSelectHeading={vi.fn()} />,
		);

		const searchInput = screen.getByPlaceholderText("Filter headings...");
		fireEvent.change(searchInput, { target: { value: "Deep" } });

		expect(screen.queryByText("Title 1")).not.toBeInTheDocument();
		expect(screen.getByText("Deep Section")).toBeInTheDocument();
	});
});
