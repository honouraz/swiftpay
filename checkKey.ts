// checkKey.ts   ← create this file for root
import "dotenv/config";

console.log("YOUR KEY DEY SHOW? →", process.env.PAYSTACK_SECRET_KEY);
console.log("First 15 chars →", process.env.PAYSTACK_SECRET_KEY?.substring(0, 15));
console.log("Key starts with sk_test_ ? →", process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_test_"));