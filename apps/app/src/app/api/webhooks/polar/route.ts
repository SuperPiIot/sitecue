import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { verifyPolarWebhook } from "./verify";

interface PolarWebhookPayload {
	type: string;
	data: {
		id?: string;
		customer_id?: string;
		subscription_id?: string;
		customer_metadata?: {
			user_id?: string;
			[key: string]: unknown;
		};
		metadata?: {
			reference_id?: string;
			referenceId?: string;
			user_id?: string;
			[key: string]: unknown;
		};
		subscription?: {
			id?: string;
			metadata?: {
				reference_id?: string;
				referenceId?: string;
				user_id?: string;
				[key: string]: unknown;
			};
			[key: string]: unknown;
		};
		custom_field_data?: {
			user_id?: string;
			[key: string]: unknown;
		};
		product?: {
			metadata?: {
				tier?: string;
				[key: string]: unknown;
			};
		};
	};
}

export async function POST(req: NextRequest) {
	const secret = process.env.POLAR_WEBHOOK_SECRET;
	if (!secret) {
		console.error("Missing POLAR_WEBHOOK_SECRET");
		return NextResponse.json(
			{ error: "Server misconfiguration" },
			{ status: 500 },
		);
	}

	const webhookId = req.headers.get("webhook-id") ?? "";
	const webhookTimestamp = req.headers.get("webhook-timestamp") ?? "";
	const webhookSignature = req.headers.get("webhook-signature") ?? "";
	const rawBody = await req.text();

	const isValid = await verifyPolarWebhook(
		secret,
		webhookId,
		webhookTimestamp,
		rawBody,
		webhookSignature,
	);

	if (!isValid) {
		return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
	}

	let payload: PolarWebhookPayload;
	try {
		payload = JSON.parse(rawBody) as PolarWebhookPayload;
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const eventType = payload.type;
	const data = payload.data;

	const supabaseAdmin = createClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
		process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
	);

	// 1. 注文完了またはサブスクリプション作成イベント
	if (eventType === "order.created" || eventType === "subscription.created") {
		const userId =
			data.metadata?.reference_id ||
			data.metadata?.referenceId ||
			data.subscription?.metadata?.reference_id ||
			data.subscription?.metadata?.referenceId ||
			data.customer_metadata?.user_id ||
			data.metadata?.user_id;

		if (!userId) {
			console.warn("No userId (reference_id) found in payload:", {
				metadata: data.metadata,
				subscription_metadata: data.subscription?.metadata,
			});
		}

		const tier = data.product?.metadata?.tier || "pro";
		const customerId = data.customer_id;
		const subscriptionId = data.subscription_id || data.id;

		if (userId) {
			const { error } = await supabaseAdmin
				.from("sitecue_profiles")
				.update({
					plan: tier,
					polar_customer_id: customerId,
					polar_subscription_id: subscriptionId,
				})
				.eq("id", userId);

			if (error) {
				console.error("Failed to update profile to pro:", error);
				return NextResponse.json({ error: error.message }, { status: 500 });
			}
		}
	}

	// 2. 権利失効イベント（期間満了による終了）
	if (eventType === "subscription.revoked") {
		const subscriptionId = data.id || data.subscription_id;
		if (subscriptionId) {
			const { error } = await supabaseAdmin
				.from("sitecue_profiles")
				.update({ plan: "free" })
				.eq("polar_subscription_id", subscriptionId);

			if (error) {
				console.error("Failed to revoke profile to free:", error);
				return NextResponse.json({ error: error.message }, { status: 500 });
			}
		}
	}

	// 3. 解約申請イベント（期間満了まで維持するためDB変更なし）
	if (eventType === "subscription.canceled") {
		console.log(
			`Subscription ${data.id} canceled, maintaining active until period ends.`,
		);
	}

	return NextResponse.json({ received: true });
}
