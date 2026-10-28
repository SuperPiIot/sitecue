"use client";

import { Crown, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

interface PaywallModalProps {
	isOpen: boolean;
	onClose: () => void;
	plan?: "free" | "pro";
	limitType?: "ai" | "notes" | "drafts";
}

export default function PaywallModal({
	isOpen,
	onClose,
	plan = "free",
	limitType = "ai",
}: PaywallModalProps) {
	const [userId, setUserId] = useState<string | null>(null);
	const [userEmail, setUserEmail] = useState<string | null>(null);

	useEffect(() => {
		if (isOpen) {
			const supabase = createClient();
			supabase.auth.getUser().then(({ data: { user } }) => {
				if (user) {
					setUserId(user.id);
					setUserEmail(user.email ?? null);
				}
			});
		}
	}, [isOpen]);

	if (!isOpen) return null;

	const monthlyBaseUrl =
		process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL_MONTHLY || "#";
	const yearlyBaseUrl =
		process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL_YEARLY || "#";

	const getCheckoutUrl = (baseUrl: string) => {
		if (!userId || baseUrl === "#") return baseUrl;
		const separator = baseUrl.includes("?") ? "&" : "?";
		const params = new URLSearchParams();
		params.set("reference_id", userId);
		if (userEmail) {
			params.set("customer_email", userEmail);
		}
		return `${baseUrl}${separator}${params.toString()}`;
	};

	const handleCheckout = (url: string) => {
		if (url && url !== "#") {
			window.open(url, "_blank", "noopener,noreferrer");
			onClose();
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/30 backdrop-blur-sm animate-in fade-in duration-200">
			<div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
				<div className="relative p-8 text-center text-neutral-900">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={onClose}
						aria-label="Close modal"
						className="absolute top-4 right-4 text-neutral-400 p-0 rounded-full size-8"
					>
						<X size={20} aria-hidden="true" />
					</Button>

					<div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-500">
						<Crown size={32} aria-hidden="true" />
					</div>

					<h2 className="text-2xl font-bold mb-2 tracking-tight">
						{limitType === "notes"
							? "Storage Limit Reached"
							: limitType === "drafts"
								? "Draft Limit Reached"
								: plan === "free"
									? "Monthly Generation Limit"
									: "Usage Limit Reached"}
					</h2>
					<p className="text-neutral-500 mb-6 leading-relaxed text-sm">
						{limitType === "notes" ? (
							<>
								{"You've reached the free limit (500 notes)."}
								<br />
								{"Upgrade to Pro for unlimited notes & 30,000 chars per note."}
							</>
						) : limitType === "drafts" ? (
							<>
								{"Draft storage limit reached (50/50)."}
								<br />
								{"Upgrade to Pro to create unlimited studio drafts."}
							</>
						) : plan === "free" ? (
							<>
								{"You've used all your AI generations (3/month)."}
								<br />
								{"Upgrade to Pro for 100 generations per month."}
							</>
						) : (
							"Please wait for the next billing cycle to continue using AI features."
						)}
					</p>

					{plan === "free" && (
						<div className="space-y-2.5 mb-3">
							<Button
								type="button"
								variant="default"
								className="w-full rounded-full py-5 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm hover-safe:opacity-90"
								onClick={() => handleCheckout(getCheckoutUrl(monthlyBaseUrl))}
							>
								<span>Monthly Plan ($5/month)</span>
							</Button>
							<Button
								type="button"
								variant="outline"
								className="w-full rounded-full py-5 text-sm font-semibold flex items-center justify-center gap-2 border-action/30 hover-safe:bg-action/5 cursor-pointer"
								onClick={() => handleCheckout(getCheckoutUrl(yearlyBaseUrl))}
							>
								<Sparkles
									className="size-4 text-amber-500"
									aria-hidden="true"
								/>
								<span>Yearly Plan ($48/year - Save 20%)</span>
							</Button>
						</div>
					)}

					<Button
						type="button"
						variant="ghost"
						onClick={onClose}
						className="w-full rounded-full py-2 text-xs text-neutral-400 hover-safe:text-neutral-600 cursor-pointer"
					>
						{plan === "free" ? "Maybe Later" : "Got it"}
					</Button>
				</div>

				<div className="bg-neutral-50 px-8 py-3.5 text-center border-t border-neutral-100">
					<p className="text-[10px] uppercase tracking-widest font-bold text-neutral-400">
						Stay creative with sitecue Pro
					</p>
				</div>
			</div>
		</div>
	);
}
