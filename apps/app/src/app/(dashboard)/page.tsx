import { Suspense } from "react";
import { DashboardContainer } from "./_components/DashboardContainer";
import { UpgradedToastNotifier } from "./_components/UpgradedToastNotifier";

export default function LaunchpadPage() {
	return (
		<Suspense fallback={null}>
			<UpgradedToastNotifier />
			<DashboardContainer />
		</Suspense>
	);
}
