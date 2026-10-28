"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import toast from "react-hot-toast";

export function UpgradedToastNotifier() {
	const searchParams = useSearchParams();
	const queryClient = useQueryClient();

	useEffect(() => {
		if (searchParams.get("upgraded") === "true") {
			toast.success("Welcome to sitecue Pro! 🚀", { duration: 4000 });
			queryClient.invalidateQueries();
			const url = new URL(window.location.href);
			url.searchParams.delete("upgraded");
			window.history.replaceState({}, "", url.pathname + url.search);
		}
	}, [searchParams, queryClient]);

	return null;
}
