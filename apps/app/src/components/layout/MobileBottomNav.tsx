"use client";

import { Home, Library, Search } from "lucide-react";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { UserMenu } from "@/app/(dashboard)/_components/UserMenu";
import { Button } from "@/components/ui/button";
import { CustomLink as Link } from "@/components/ui/custom-link";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/store/useLayoutStore";

interface MobileBottomNavProps {
	onSearchOpen: () => void;
}

function MobileBottomNavInner({ onSearchOpen }: MobileBottomNavProps) {
	const searchParams = useSearchParams();
	const pathname = usePathname();
	const { openGlobalNewModal } = useLayoutStore();

	const isDetailOpen = !!(
		searchParams.get("noteId") || searchParams.get("draftId")
	);

	const isStudioPage = pathname?.startsWith("/studio");
	const isNotes = pathname?.startsWith("/notes");
	const isDiariesPage =
		pathname?.startsWith("/diaries") || !!searchParams.get("date");

	// 詳細ペイン展開時、スタジオページ、または日記ページ/詳細ではボトムナビを隠す
	if (isDetailOpen || isStudioPage || isDiariesPage) return null;

	return (
		<nav className="md:hidden shrink-0 w-auto mx-4 mb-4 pb-safe z-40 bg-action rounded-full shadow-lg overflow-visible border border-white/5">
			{/* Flexベースの完全シンメトリー構造 */}
			<div className="flex justify-between items-center h-16 px-4">
				{/* 左端エリア：ホームボタン */}
				<div className="w-12 flex justify-start items-center">
					<Link
						href="/"
						variant="ghost"
						size="icon"
						className="size-10 text-white/60 hover-safe:text-white hover-safe:bg-white/10 transition-all active:scale-95"
						aria-label="Home"
					>
						<Home className="size-[18px]" aria-hidden="true" />
					</Link>
				</div>

				{/* 中央エリア：メインアクション（Notes, New Note, Search） */}
				<div className="flex-1 flex justify-center items-center">
					<div className="w-48 h-13 bg-base-surface rounded-full flex items-center justify-between p-0.5 shrink-0 shadow-sm">
						<Link
							href="/notes"
							variant={isNotes ? "secondary" : "ghost"}
							size="icon"
							className={cn(
								"size-12 transition-all",
								isNotes
									? "bg-base-bg text-action scale-105"
									: "text-gray-500 hover-safe:text-action hover-safe:bg-base-bg",
							)}
							aria-label="Notes"
						>
							<Library className="size-6" aria-hidden="true" />
						</Link>

						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={() => {
								openGlobalNewModal("gate");
							}}
							className="size-12 border-none p-0.5 transition-transform active:scale-95 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:ring-transparent focus-visible:shadow-none focus-visible:border-transparent"
							aria-label="New Note"
						>
							<Image
								src="/logo.svg"
								alt="New Note"
								width={44}
								height={44}
								className="w-full h-full object-contain drop-shadow-sm"
							/>
						</Button>

						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={onSearchOpen}
							className="size-12 text-gray-500 hover-safe:text-action hover-safe:bg-base-bg transition-colors"
							aria-label="Search"
						>
							<Search className="size-6" aria-hidden="true" />
						</Button>
					</div>
				</div>

				{/* 右端エリア：UserMenu（w-12固定でシンメトリーを維持） */}
				<div className="w-12 flex justify-end items-center">
					<Suspense fallback={null}>
						<UserMenu side="top" align="end" sideOffset={12} />
					</Suspense>
				</div>
			</div>
		</nav>
	);
}

export function MobileBottomNav(props: MobileBottomNavProps) {
	return (
		<Suspense fallback={null}>
			<MobileBottomNavInner {...props} />
		</Suspense>
	);
}
