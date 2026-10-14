"use client";

import {
	fetchDashboardActivityData,
	fetchDashboardDomainActivity,
	fetchDashboardOverviewData,
} from "@sitecue/shared/dal";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";

export const DASHBOARD_QUERY_KEY = ["dashboard"];

export function useFetchDashboardActivity() {
	return useQuery({
		queryKey: [...DASHBOARD_QUERY_KEY, "activity"],
		staleTime: 5 * 60 * 1000,
		queryFn: async () => {
			const supabase = createClient();
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error("Unauthenticated");

			return await fetchDashboardActivityData(supabase, user.id);
		},
	});
}

export function useFetchDashboardDomains() {
	return useQuery({
		queryKey: [...DASHBOARD_QUERY_KEY, "domains"],
		staleTime: 5 * 60 * 1000,
		queryFn: async () => {
			const supabase = createClient();
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error("Unauthenticated");

			return await fetchDashboardDomainActivity(supabase, user.id, 6);
		},
	});
}

export function useFetchDashboardData() {
	return useQuery({
		queryKey: [...DASHBOARD_QUERY_KEY, "data"],
		staleTime: 5 * 60 * 1000,
		queryFn: async () => {
			const supabase = createClient();
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error("Unauthenticated");

			return await fetchDashboardOverviewData(supabase, user.id);
		},
	});
}
