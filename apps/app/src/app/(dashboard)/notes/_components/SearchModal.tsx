"use client";

import {
	buildNoteContextHref,
	type Diary,
	normalizeUrlForGrouping,
} from "@sitecue/shared";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import { SearchInputBase } from "@/components/ui/search-input-base";
import { useFetchDiaries } from "@/hooks/useDiariesQuery";
import { useFetchNoteContents, useSearchNotes } from "@/hooks/useNotesQuery";
import type { Note } from "../types";

interface SearchModalProps {
	isOpen: boolean;
	onClose: () => void;
}

const getScopeDisplayLabel = (scope: Note["scope"] | string): string => {
	switch (scope) {
		case "draft":
			return "Studio Review";
		case "inbox":
			return "Inbox";
		case "domain":
			return "Domain";
		case "exact":
			return "Page";
		default:
			return "Note";
	}
};

const getNoteSubLabel = (note: Note): string => {
	if (note.scope === "draft") return "Review note in Studio";
	if (note.scope === "inbox") return "Inbox";
	return note.url_pattern;
};

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
	const router = useRouter();
	const [inputValue, setInputValue] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const { data = { notes: [], drafts: [] }, isLoading } =
		useSearchNotes(searchQuery);
	const { data: diariesData = [] } = useFetchDiaries();
	const { mutate: fetchContents } = useFetchNoteContents();
	const inputRef = useRef<HTMLInputElement>(null);

	// Auto focus on mount
	useEffect(() => {
		if (isOpen) {
			const timer = setTimeout(() => {
				inputRef.current?.focus();
			}, 100);
			return () => clearTimeout(timer);
		}
	}, [isOpen]);

	const groupedResults = useMemo(() => {
		const domains = new Set<string>();
		const pages = new Set<string>();
		const notes: Note[] = [];
		const diaries: Diary[] = [];

		data.notes.forEach((note) => {
			if (
				note.url_pattern &&
				note.scope !== "inbox" &&
				note.scope !== "draft"
			) {
				const domain = normalizeUrlForGrouping(note.url_pattern).split("/")[0];
				const domainMatches = domain
					.toLowerCase()
					.includes(searchQuery.toLowerCase());

				// DOMAINS: ドメイン部分が部分一致した場合のみ表示
				if (domainMatches) {
					domains.add(domain);
				}

				// PAGES: URL全体が部分一致し、かつドメイン部分がマッチしない場合のみ表示
				if (note.scope === "exact") {
					const exactMatches = note.url_pattern
						.toLowerCase()
						.includes(searchQuery.toLowerCase());
					if (exactMatches && !domainMatches) {
						pages.add(note.url_pattern);
					}
				}
			}
			if (note.content?.toLowerCase().includes(searchQuery.toLowerCase())) {
				notes.push(note);
			}
		});

		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			diariesData.forEach((diary) => {
				const contentMatch = diary.content?.toLowerCase().includes(q);
				const dateMatch = diary.date?.toLowerCase().includes(q);
				const topicsMatch = diary.topics?.some((t) =>
					t.toLowerCase().includes(q),
				);
				if (contentMatch || dateMatch || topicsMatch) {
					diaries.push(diary);
				}
			});
		}

		return {
			domains: Array.from(domains),
			pages: Array.from(pages),
			notes,
			drafts: data.drafts,
			diaries,
		};
	}, [data, diariesData, searchQuery]);

	// Fetch contents for search results to show snippets
	useEffect(() => {
		if (data.notes.length > 0) {
			const missingIds = data.notes
				.filter((n) => n.content === undefined)
				.map((n) => n.id);
			if (missingIds.length > 0) {
				fetchContents(missingIds);
			}
		}
	}, [data.notes, fetchContents]);

	const handleJump = (note: Note) => {
		const href = buildNoteContextHref({
			id: note.id,
			scope: note.scope,
			url_pattern: note.url_pattern,
			draft_id: note.draft_id,
		});
		onClose();
		router.push(href);
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogOverlay className="z-50 bg-black/20 backdrop-blur-sm" />
			<DialogContent
				className="z-50 w-[95vw] sm:max-w-xl top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-0 overflow-visible border-none shadow-2xl bg-transparent"
				showCloseButton={false}
			>
				{/* モーダルの外側（右上）に配置する閉じるボタン */}
				<div className="absolute -top-12 right-0 md:-right-12 md:top-0">
					<button
						type="button"
						onClick={onClose}
						className="p-2 text-white/70 hover:text-white transition-colors cursor-pointer bg-black/20 hover:bg-black/40 rounded-full"
						aria-label="Close modal"
					>
						<X className="w-6 h-6" aria-hidden="true" />
					</button>
				</div>

				{/* メインコンテナ */}
				<div className="flex flex-col bg-base-bg rounded-xl overflow-hidden max-h-[75vh] md:max-h-[60vh]">
					<div className="px-2 py-2 border-b border-base-border">
						<SearchInputBase
							ref={inputRef}
							value={inputValue}
							onChange={setInputValue}
							onClear={() => {
								setInputValue("");
								setSearchQuery(""); // 結果もクリア
							}}
							onSubmit={() => setSearchQuery(inputValue)}
							placeholder="Search notes..."
							className="border-none bg-transparent focus-within:ring-0"
						/>
					</div>

					<div className="overflow-y-auto p-2">
						{isLoading ? (
							<div className="p-4 text-center text-gray-400 animate-pulse">
								Searching...
							</div>
						) : searchQuery &&
							data.notes.length === 0 &&
							data.drafts.length === 0 &&
							groupedResults.diaries.length === 0 ? (
							<div className="p-8 text-center text-gray-400">
								No results found for "{searchQuery}"
							</div>
						) : (
							<div className="space-y-4">
								{groupedResults.domains.length > 0 && (
									<div>
										<h3 className="px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
											Domains
										</h3>
										<div className="space-y-1">
											{groupedResults.domains.map((domain) => (
												<button
													key={domain}
													type="button"
													onClick={() => {
														onClose();
														router.push(`/notes?domain=${domain}`);
													}}
													className="w-full text-left px-3 py-2 rounded-lg hover-safe:bg-base-surface transition-colors cursor-pointer text-sm"
												>
													{domain}
												</button>
											))}
										</div>
									</div>
								)}

								{groupedResults.pages.length > 0 && (
									<div>
										<h3 className="px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
											Pages
										</h3>
										<div className="space-y-1">
											{groupedResults.pages.map((page) => (
												<button
													key={page}
													type="button"
													onClick={() => {
														onClose();
														const domain =
															normalizeUrlForGrouping(page).split("/")[0];
														router.push(
															`/notes?domain=${domain}&exact=${page}`,
														);
													}}
													className="w-full text-left px-3 py-2 rounded-lg hover-safe:bg-base-surface transition-colors cursor-pointer text-sm truncate"
												>
													{page}
												</button>
											))}
										</div>
									</div>
								)}

								{groupedResults.drafts.length > 0 && (
									<div>
										<h3 className="px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
											Drafts
										</h3>
										<div className="space-y-1">
											{groupedResults.drafts.map((draft) => (
												<button
													key={draft.id}
													type="button"
													onClick={() => {
														onClose();
														router.push(
															`/notes?view=drafts&draftId=${draft.id}`,
														);
													}}
													className="w-full text-left px-3 py-2 rounded-lg hover-safe:bg-base-surface transition-colors cursor-pointer group"
												>
													<div className="flex items-center justify-between mb-1">
														<span className="text-xs font-semibold text-gray-400 uppercase tracking-wider truncate mr-2">
															{draft.title || "Untitled Draft"}
														</span>
														<span className="text-[10px] text-gray-400 shrink-0">
															{new Date(draft.updated_at).toLocaleDateString()}
														</span>
													</div>
													<p className="text-sm text-action font-medium line-clamp-2">
														{draft.content || "No content"}
													</p>
												</button>
											))}
										</div>
									</div>
								)}

								{groupedResults.notes.length > 0 && (
									<div>
										<h3 className="px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
											Notes
										</h3>
										<div className="space-y-1">
											{groupedResults.notes.map((note) => (
												<button
													key={note.id}
													type="button"
													onClick={() => handleJump(note)}
													className="w-full text-left px-3 py-2 rounded-lg hover-safe:bg-base-surface transition-colors cursor-pointer group"
												>
													<div className="flex items-center justify-between mb-1">
														<span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
															{getScopeDisplayLabel(note.scope)} •{" "}
															{note.note_type}
														</span>
														<span className="text-[10px] text-gray-400">
															{new Date(note.created_at).toLocaleDateString()}
														</span>
													</div>
													<p className="text-sm text-action font-medium line-clamp-2 mb-1">
														{note.content || "No content"}
													</p>
													<p className="text-[10px] text-gray-400 truncate">
														{getNoteSubLabel(note)}
													</p>
												</button>
											))}
										</div>
									</div>
								)}

								{groupedResults.diaries.length > 0 && (
									<div>
										<h3 className="px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
											Diaries
										</h3>
										<div className="space-y-1">
											{groupedResults.diaries.map((diary) => {
												const [yyyy, mm] = diary.date.split("-");
												const diaryDate = new Date(diary.date);
												const dayLabel = diaryDate.toLocaleDateString("en-US", {
													day: "numeric",
													weekday: "short",
												});
												const firstLine =
													diary.content.split("\n")[0] || "No content";
												return (
													<button
														key={diary.date}
														type="button"
														onClick={() => {
															onClose();
															router.push(
																`/notes?view=diaries&year=${yyyy}&month=${mm}&date=${diary.date}`,
															);
														}}
														className="w-full text-left px-3 py-2 rounded-lg hover-safe:bg-base-surface transition-colors cursor-pointer group text-sm"
													>
														<div className="flex items-center justify-between mb-1">
															<span className="text-xs font-semibold text-note-info tracking-wider">
																{diary.date} ({dayLabel})
															</span>
														</div>
														<p className="text-sm text-action font-medium truncate">
															{firstLine}
														</p>
													</button>
												);
											})}
										</div>
									</div>
								)}
							</div>
						)}
					</div>

					{!searchQuery && (
						<div className="p-4 text-center text-xs text-gray-400 border-t border-base-border">
							Type and press Enter to search your notes across domains
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
