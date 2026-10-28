import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { verifyPolarWebhook } from "./verify";

const mockUpdate = vi.fn().mockReturnValue({
	eq: vi.fn().mockResolvedValue({ error: null }),
});
const mockFrom = vi.fn().mockReturnValue({
	update: mockUpdate,
});

vi.mock("@supabase/supabase-js", () => ({
	createClient: vi.fn(() => ({
		from: mockFrom,
	})),
}));

async function createSignedRequest(
	secret: string,
	id: string,
	timestamp: string,
	payload: Record<string, unknown>,
): Promise<NextRequest> {
	const body = JSON.stringify(payload);
	const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
	const keyBytes = Uint8Array.from(atob(rawSecret), (c) => c.charCodeAt(0));
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		keyBytes,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sigBuffer = await crypto.subtle.sign(
		"HMAC",
		cryptoKey,
		new TextEncoder().encode(`${id}.${timestamp}.${body}`),
	);
	const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

	return new Request("http://127.0.0.1/api/webhooks/polar", {
		method: "POST",
		headers: {
			"webhook-id": id,
			"webhook-timestamp": timestamp,
			"webhook-signature": `v1,${sigBase64}`,
		},
		body,
	}) as unknown as NextRequest;
}

describe("Polar Webhook Verification and Dispatch", () => {
	const secret = "whsec_testsecret1234567890123456789012";

	beforeEach(() => {
		vi.clearAllMocks();
		process.env.POLAR_WEBHOOK_SECRET = secret;
		process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
		process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
	});

	it("正しいHMAC署名リクエストを検証できること", async () => {
		const id = "evt_123";
		const timestamp = Math.floor(Date.now() / 1000).toString();
		const body = JSON.stringify({ type: "order.created" });

		// HMAC生成
		const rawSecret = secret.slice(6);
		const keyBytes = Uint8Array.from(atob(rawSecret), (c) => c.charCodeAt(0));
		const cryptoKey = await crypto.subtle.importKey(
			"raw",
			keyBytes,
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const sigBuffer = await crypto.subtle.sign(
			"HMAC",
			cryptoKey,
			new TextEncoder().encode(`${id}.${timestamp}.${body}`),
		);
		const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
		const signatureHeader = `v1,${sigBase64}`;

		const isValid = await verifyPolarWebhook(
			secret,
			id,
			timestamp,
			body,
			signatureHeader,
		);
		expect(isValid).toBe(true);
	});

	it("不正な署名の場合は 403 を返却すること", async () => {
		const req = new Request("http://127.0.0.1/api/webhooks/polar", {
			method: "POST",
			headers: {
				"webhook-id": "evt_123",
				"webhook-timestamp": Math.floor(Date.now() / 1000).toString(),
				"webhook-signature": "v1,invalidsignature",
			},
			body: JSON.stringify({ type: "order.created" }),
		});

		const res = await POST(req as unknown as NextRequest);
		expect(res.status).toBe(403);
	});

	it("metadata.reference_id を指定した order.created でプロフィールが pro に更新されること", async () => {
		const id = "evt_order_ref_123";
		const timestamp = Math.floor(Date.now() / 1000).toString();
		const payload = {
			type: "order.created",
			data: {
				id: "order_123",
				customer_id: "cus_123",
				metadata: { reference_id: "user_from_reference_id" },
				product: { metadata: { tier: "pro" } },
			},
		};

		const req = await createSignedRequest(secret, id, timestamp, payload);
		const res = await POST(req);

		expect(res.status).toBe(200);
		expect(mockFrom).toHaveBeenCalledWith("sitecue_profiles");
		expect(mockUpdate).toHaveBeenCalledWith({
			plan: "pro",
			polar_customer_id: "cus_123",
			polar_subscription_id: "order_123",
		});
	});

	it("subscription.metadata.reference_id を指定した subscription.created でプロフィールが pro に更新されること", async () => {
		const id = "evt_sub_created_123";
		const timestamp = Math.floor(Date.now() / 1000).toString();
		const payload = {
			type: "subscription.created",
			data: {
				id: "sub_123",
				customer_id: "cus_456",
				subscription: {
					id: "sub_123",
					metadata: { reference_id: "user_from_sub_ref" },
				},
				product: { metadata: { tier: "pro" } },
			},
		};

		const req = await createSignedRequest(secret, id, timestamp, payload);
		const res = await POST(req);

		expect(res.status).toBe(200);
		expect(mockFrom).toHaveBeenCalledWith("sitecue_profiles");
		expect(mockUpdate).toHaveBeenCalledWith({
			plan: "pro",
			polar_customer_id: "cus_456",
			polar_subscription_id: "sub_123",
		});
	});

	it("userId が見つからない場合は警告ログを出力し更新をスキップすること", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const id = "evt_order_no_user";
		const timestamp = Math.floor(Date.now() / 1000).toString();
		const payload = {
			type: "order.created",
			data: {
				id: "order_999",
				customer_id: "cus_999",
				product: { metadata: { tier: "pro" } },
			},
		};

		const req = await createSignedRequest(secret, id, timestamp, payload);
		const res = await POST(req);

		expect(res.status).toBe(200);
		expect(warnSpy).toHaveBeenCalledWith(
			"No userId (reference_id) found in payload:",
			expect.any(Object),
		);
		expect(mockUpdate).not.toHaveBeenCalled();
		warnSpy.mockRestore();
	});

	it("subscription.revoked で plan が free に更新されること", async () => {
		const id = "evt_revoked_123";
		const timestamp = Math.floor(Date.now() / 1000).toString();
		const payload = {
			type: "subscription.revoked",
			data: {
				id: "sub_123",
			},
		};

		const req = await createSignedRequest(secret, id, timestamp, payload);
		const res = await POST(req);

		expect(res.status).toBe(200);
		expect(mockFrom).toHaveBeenCalledWith("sitecue_profiles");
		expect(mockUpdate).toHaveBeenCalledWith({
			plan: "free",
		});
	});
});
