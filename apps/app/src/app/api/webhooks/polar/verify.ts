// Standard Webhooks (Svix互換) 署名検証関数 (Web Crypto API使用)
export async function verifyPolarWebhook(
	secret: string,
	webhookId: string,
	webhookTimestamp: string,
	rawBody: string,
	signatureHeader: string,
): Promise<boolean> {
	if (!secret || !webhookId || !webhookTimestamp || !signatureHeader) {
		return false;
	}

	// タイムスタンプ許容範囲チェック (5分以内)
	const now = Math.floor(Date.now() / 1000);
	const timestampNum = Number.parseInt(webhookTimestamp, 10);
	if (Number.isNaN(timestampNum) || Math.abs(now - timestampNum) > 300) {
		return false;
	}

	// シークレット鍵の解決 (whsec_ プレフィックスの base64 または平文)
	const rawSecretKey = secret.startsWith("whsec_") ? secret.slice(6) : secret;
	const keyBytes = secret.startsWith("whsec_")
		? Uint8Array.from(atob(rawSecretKey), (c) => c.charCodeAt(0))
		: new TextEncoder().encode(rawSecretKey);

	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		keyBytes,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	const signedPayload = `${webhookId}.${webhookTimestamp}.${rawBody}`;
	const signatureBuffer = await crypto.subtle.sign(
		"HMAC",
		cryptoKey,
		new TextEncoder().encode(signedPayload),
	);

	// base64エンコード
	const expectedSignature = btoa(
		String.fromCharCode(...new Uint8Array(signatureBuffer)),
	);

	// v1,xxx の形式からシグネチャを抽出して照合
	const signatures = signatureHeader.split(" ");
	return signatures.some((sig) => {
		const parts = sig.split(",");
		if (parts.length === 2 && parts[0] === "v1") {
			return parts[1] === expectedSignature;
		}
		return false;
	});
}
