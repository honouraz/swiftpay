// src/utils/monnifyService.ts
import axios from "axios";

const BASE = process.env.MONNIFY_BASE_URL!;
const CONTRACT = process.env.MONNIFY_CONTRACT_CODE!;
const API_KEY = process.env.MONNIFY_API_KEY!;
const SECRET_KEY = process.env.MONNIFY_SECRET_KEY!;

let cachedToken: { token: string; expires: number } | null = null;

// 1. get access token
export async function getToken(): Promise<string> {
  if (
    cachedToken &&
    cachedToken.expires > Date.now() + 5 * 60 * 1000
  ) {
    return cachedToken.token;
  }
  const resp = await axios.post(
    `${BASE}/api/v1/auth/login`,
    {},
    { auth: { username: API_KEY, password: SECRET_KEY } }
  );
  const token = resp.data.responseBody.accessToken;
  const ttl = resp.data.responseBody.expiresIn; // seconds
  cachedToken = { token, expires: Date.now() + ttl * 1000 };
  return token;
}

// 2. initialize Monnify transaction
export async function initMonnifyPayment(amount: number, metadata: any) {
  const token = await getToken();
  const paymentReference = "SPAY-" + Date.now(); // your reference

  const resp = await axios.post(
    `${BASE}/api/v1/merchant/transactions/init-transaction`,
    {
      contractCode: CONTRACT,
      amount,
      currency: "NGN",
      paymentReference,
      paymentDescription: metadata.dueName,
      customerName: metadata.payerName,
      customerEmail: metadata.email,
      redirectUrl: process.env.FRONTEND_CALLBACK_URL, // set in .env
      metadata,
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return resp.data.responseBody.checkoutUrl;
}
