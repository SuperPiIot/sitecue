"use client";

import { useUserStore } from "@/store/useUserStore";

interface ComingSoonButtonProps {
	className?: string;
	text: string;
}

export function ComingSoonButton({ className, text }: ComingSoonButtonProps) {
	const openPaywall = useUserStore((state) => state.openPaywall);

	return (
		<button
			type="button"
			onClick={() => openPaywall("notes")}
			className={className}
		>
			{text}
		</button>
	);
}
