import { Activity, Clock, PenSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function PinnedSitesSkeleton() {
	return (
		<div className="flex gap-4 overflow-hidden mb-8 md:mb-16">
			<Skeleton className="h-10 w-24 rounded-full" />
			<Skeleton className="h-10 w-32 rounded-full" />
			<Skeleton className="h-10 w-28 rounded-full" />
		</div>
	);
}

export function StatsOverviewSkeleton() {
	return (
		<div>
			<div className="mb-4 md:mb-8 flex items-center gap-2">
				<Activity className="w-5 h-5 text-neutral-400" aria-hidden="true" />
				<h1 className="text-xl font-light text-action tracking-tight">
					Overview
				</h1>
			</div>
			<div className="flex flex-col gap-4">
				<div className="flex items-center justify-between border-b border-base-border pb-2 h-9">
					<Skeleton className="h-3 w-20" />
					<Skeleton className="h-6 w-8" />
				</div>
				<div className="flex items-center justify-between border-b border-base-border pb-2 h-9">
					<Skeleton className="h-3 w-24" />
					<Skeleton className="h-6 w-8" />
				</div>
			</div>
		</div>
	);
}

export function RecentDraftsSkeleton() {
	return (
		<div>
			<div className="mb-4 md:mb-6 flex items-center justify-between h-6">
				<div className="flex items-center gap-2">
					<Clock className="w-4 h-4 text-neutral-400" aria-hidden="true" />
					<h2 className="text-lg text-action tracking-tight">Recent Drafts</h2>
				</div>
				<Skeleton className="h-4 w-12" />
			</div>
			<div className="flex flex-col">
				{[
					"recent-draft-skel-1",
					"recent-draft-skel-2",
					"recent-draft-skel-3",
				].map((id) => (
					<div
						key={id}
						className="flex items-center justify-between py-3 border-b border-base-border/50 -mx-3 px-3 h-[45px]"
					>
						<Skeleton className="h-4 w-48" />
						<Skeleton className="h-3 w-20 ml-4" />
					</div>
				))}
			</div>
		</div>
	);
}

export function TemplateSelectorSkeleton() {
	return (
		<>
			<div className="mb-6 md:mb-8 flex items-center justify-between h-7">
				<div className="flex items-center gap-2">
					<PenSquare className="w-5 h-5 text-neutral-400" aria-hidden="true" />
					<h2 className="text-xl text-action font-light tracking-tight">
						Start a Draft
					</h2>
				</div>
				<Skeleton className="h-4 w-24" />
			</div>
			<div className="grid gap-6 sm:grid-cols-3">
				<Skeleton className="h-[108px] rounded-xl" />
				<Skeleton className="h-[108px] rounded-xl" />
				<Skeleton className="h-[108px] rounded-xl" />
			</div>
		</>
	);
}

export function TodayRecapCardSkeleton() {
	return (
		<div className="flex flex-col justify-between items-center p-5 rounded-xl bg-base-surface border border-base-border h-full min-h-[340px] md:min-h-[320px]">
			<div className="flex justify-between items-start w-full">
				<Skeleton className="h-3 w-24" />
				<Skeleton className="h-7 w-7 rounded-full" />
			</div>
			<div className="flex flex-col items-center gap-4 my-4 flex-1 w-full">
				<Skeleton className="w-24 h-28 md:w-20 md:h-24 lg:w-28 lg:h-32 rounded-xl" />
				<Skeleton className="h-4 w-36 rounded-full" />
				<div className="flex flex-col items-center gap-1 mt-2">
					<Skeleton className="h-9 w-12" />
					<Skeleton className="h-3 w-24" />
				</div>
			</div>
		</div>
	);
}

export function RadialActivityChartSkeleton() {
	return (
		<div className="flex flex-col md:flex-row items-center gap-6 p-6 rounded-xl border border-base-border bg-base-bg md:col-span-2 min-h-[190px]">
			<Skeleton className="w-32 h-32 rounded-full shrink-0" />
			<div className="flex-1 flex flex-col justify-center gap-4 w-full">
				<div className="space-y-2">
					<Skeleton className="h-6 w-40" />
					<Skeleton className="h-3 w-64" />
				</div>
				<div className="flex flex-col gap-3 pt-1">
					<div className="flex items-center justify-between">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-4 w-8" />
					</div>
					<div className="flex items-center justify-between">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-4 w-8" />
					</div>
				</div>
			</div>
		</div>
	);
}

export function DomainDashboardCardSkeleton() {
	return (
		<div className="border border-base-border rounded-xl p-5 flex flex-col gap-4 bg-base-bg">
			<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 items-center w-full pb-3 border-b border-base-border/50">
				<div className="flex items-center gap-2">
					<Skeleton className="h-6 w-6 rounded-md" />
					<Skeleton className="h-7 w-40" />
				</div>
				<Skeleton className="h-9 w-16 rounded-full" />
			</div>
			<div className="flex flex-col gap-2">
				<Skeleton className="h-4 w-3/4" />
				<Skeleton className="h-4 w-1/2" />
			</div>
		</div>
	);
}

export function DomainDashboardGridSkeleton() {
	return (
		<div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
			<DomainDashboardCardSkeleton />
			<DomainDashboardCardSkeleton />
		</div>
	);
}

export function ContributionTimelineSkeleton() {
	return (
		<div className="flex flex-col border-l border-base-border ml-2 pl-4 gap-6 w-full min-w-0 min-h-[160px]">
			{["skel-1", "skel-2"].map((id) => (
				<div key={id} className="flex flex-col gap-3">
					<div className="flex items-center gap-2">
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-3 w-24" />
					</div>
					<div className="flex flex-col gap-2 pl-2 border-l border-neutral-100 dark:border-neutral-800">
						<Skeleton className="h-3 w-28" />
						<Skeleton className="h-5 w-full max-w-md" />
						<Skeleton className="h-5 w-3/4 max-w-sm" />
					</div>
				</div>
			))}
		</div>
	);
}

export function TodayEntryCountSkeleton() {
	return (
		<div className="flex flex-col justify-center items-center text-center mt-2">
			<Skeleton className="h-10 w-36 rounded-lg" />
		</div>
	);
}
