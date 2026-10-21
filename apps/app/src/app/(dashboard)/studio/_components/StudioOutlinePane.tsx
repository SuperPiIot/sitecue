"use client";

import { Hash, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface HeadingItem {
	id: string;
	level: number;
	text: string;
	line: number;
	pos: number;
}

export function parseHeadings(content: string): HeadingItem[] {
	if (!content) return [];
	const lines = content.split("\n");
	const headings: HeadingItem[] = [];

	// 開いているフェンスの文字（'`' または '~'）と長さを追跡
	let activeFence: { char: string; length: number } | null = null;
	let currentPos = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		if (activeFence) {
			// 閉じフェンス判定: 開始フェンスと同じ文字が同じ長さ以上連続し、それ以外の文字がないこと
			const closeFenceRegex = new RegExp(
				`^${activeFence.char}{${activeFence.length},}\\s*$`,
			);
			if (closeFenceRegex.test(trimmed)) {
				activeFence = null;
			}
			currentPos += line.length + 1;
			continue;
		}

		// 開始フェンス判定: 3つ以上の ` または ~ で始まる行
		const openFenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
		if (openFenceMatch) {
			const fenceStr = openFenceMatch[1];
			// 1行で閉じるインラインフェンス（例: ```code```）でなければブロック開始
			const restOfLine = trimmed.slice(fenceStr.length);
			if (!restOfLine.includes(fenceStr[0])) {
				activeFence = { char: fenceStr[0], length: fenceStr.length };
				currentPos += line.length + 1;
				continue;
			}
		}

		// 見出し判定（コードブロック外のみ）
		const match = line.match(/^(#{1,4})\s+(.+)$/);
		if (match) {
			const level = match[1].length;
			const text = match[2].trim();
			headings.push({
				id: `heading-${i}-${currentPos}`,
				level,
				text,
				line: i + 1,
				pos: currentPos,
			});
		}

		currentPos += line.length + 1;
	}

	return headings;
}

interface StudioOutlinePaneProps {
	content: string;
	onSelectHeading: (item: HeadingItem) => void;
}

export default function StudioOutlinePane({
	content,
	onSelectHeading,
}: StudioOutlinePaneProps) {
	const [searchQuery, setSearchQuery] = useState("");

	const headings = useMemo(() => parseHeadings(content), [content]);

	const filteredHeadings = useMemo(() => {
		if (!searchQuery.trim()) return headings;
		const query = searchQuery.toLowerCase();
		return headings.filter((h) => h.text.toLowerCase().includes(query));
	}, [headings, searchQuery]);

	return (
		<div className="flex h-full flex-col bg-neutral-50/10 min-w-0 w-full overflow-hidden">
			{/* 1. Header & Filter */}
			<div className="p-4 border-b border-neutral-200 bg-white/50 z-10 backdrop-blur-md shrink-0">
				<div className="relative flex items-center w-full">
					<Search
						className="absolute left-3 w-3.5 h-3.5 text-neutral-400 pointer-events-none"
						aria-hidden="true"
					/>
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Filter headings..."
						className="w-full bg-base-surface border border-base-border rounded-full pl-9 pr-8 py-1.5 text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-action transition-colors"
					/>
					{searchQuery && (
						<button
							type="button"
							onClick={() => setSearchQuery("")}
							className="absolute right-2.5 p-0.5 text-neutral-400 hover:text-neutral-600 rounded-full cursor-pointer"
							aria-label="Clear filter"
						>
							<X aria-hidden="true" className="w-3.5 h-3.5" />
						</button>
					)}
				</div>
			</div>

			{/* 2. Headings List */}
			<div className="flex-1 p-4 overflow-y-auto w-full min-w-0 min-h-0">
				{filteredHeadings.length === 0 ? (
					<div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 px-4 py-8 text-center text-neutral-400">
						<Hash aria-hidden="true" className="w-5 h-5 mb-1.5 opacity-40" />
						<p className="text-xs font-medium">No headings found</p>
						<p className="mt-1 text-[10px]">
							{searchQuery
								? "Try a different search keyword."
								: "Use #, ##, or ### in the editor to structure your document."}
						</p>
					</div>
				) : (
					<nav
						aria-label="Table of contents"
						className="flex flex-col gap-1 w-full min-w-0"
					>
						{filteredHeadings.map((h) => {
							const indentClass =
								h.level === 1
									? "pl-2 font-bold text-neutral-800 text-xs"
									: h.level === 2
										? "pl-5 font-semibold text-neutral-700 text-xs"
										: h.level === 3
											? "pl-8 text-neutral-600 text-[11px]"
											: "pl-11 text-neutral-500 text-[11px]";

							return (
								<button
									key={h.id}
									type="button"
									onClick={() => onSelectHeading(h)}
									className={cn(
										"group flex items-center justify-between w-full py-1.5 pr-2 rounded-lg text-left hover:bg-base-surface hover:text-action transition-colors cursor-pointer select-none min-w-0",
										indentClass,
									)}
								>
									<span className="truncate flex-1 pr-2">{h.text}</span>
									<span className="text-[10px] font-mono text-neutral-300 group-hover:text-action/50 shrink-0 uppercase">
										H{h.level}
									</span>
								</button>
							);
						})}
					</nav>
				)}
			</div>
		</div>
	);
}
