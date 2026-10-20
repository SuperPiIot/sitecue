"use client";

import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { SearchModal } from "@/app/(dashboard)/notes/_components/SearchModal";
import PaywallModal from "@/app/(dashboard)/studio/_components/PaywallModal";
import { GlobalNewNoteDialog } from "@/components/dialogs/GlobalNewNoteDialog";
import { useLayoutStore } from "@/store/useLayoutStore";
import { useUserStore } from "@/store/useUserStore";
import { GlobalSidebar } from "./GlobalSidebar";
import { MobileBottomNav } from "./MobileBottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
	const _pathname = usePathname();
	const _isSidebarOpen = useLayoutStore((state) => state.isSidebarOpen);
	const _setIsSidebarOpen = useLayoutStore((state) => state.setIsSidebarOpen);

	const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
	const { isPaywallOpen, paywallType, closePaywall, plan } = useUserStore();

	return (
		<div className="w-full bg-base-bg min-h-dvh flex flex-col">
			<div className="flex h-dvh w-full overflow-hidden bg-base-bg text-action">
				{/* PC Sidebar (Persistent Rail UI) */}
				<aside className="hidden md:flex flex-col w-20 shrink-0 my-4 mx-4 items-center overflow-visible">
					<Suspense fallback={null}>
						<GlobalSidebar onSearchOpen={() => setIsSearchModalOpen(true)} />
					</Suspense>
				</aside>

				<main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
					{/* Content Area: ヘッダー廃止に伴い pt-2 で上端の息抜き余白を確保 */}
					<div className="flex-1 overflow-y-auto relative flex flex-col min-w-0 pt-2 md:pt-0">
						{children}
					</div>

					<MobileBottomNav onSearchOpen={() => setIsSearchModalOpen(true)} />
				</main>
			</div>

			{/* Global Dialog */}
			<Suspense fallback={null}>
				<GlobalNewNoteDialog />
			</Suspense>

			<SearchModal
				isOpen={isSearchModalOpen}
				onClose={() => setIsSearchModalOpen(false)}
			/>

			<PaywallModal
				isOpen={isPaywallOpen}
				onClose={closePaywall}
				plan={plan as "free" | "pro"}
				limitType={paywallType}
			/>
		</div>
	);
}
