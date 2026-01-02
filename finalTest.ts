// finalTest.ts  ← create this new file for root
import "dotenv/config";
import axios from "axios";

// FIRST — SHOW US THE KEY WEY DEY INSIDE THIS PROCESS
console.log("=== ENV CHECK ===");
console.log("KEY FROM process.env →", process.env.PAYSTACK_SECRET_KEY?.substring(0, 20) + "...");
console.log("Key length →", process.env.PAYSTACK_SECRET_KEY?.length || 0);
console.log("Starts with sk_test_ →", process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_test_"));
console.log("====================");

// NOW DO THE PAYSTACK CALL DIRECTLY
async function testPaystack() {
  try {
    const res = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: "test@gmail.com",
        amount: 100000, // ₦1000
        currency: "NGN",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    console.log("PAYSTACK SUCCESS!!!");
    console.log("Reference →", res.data.data.reference);
    console.log("Link →", res.data.data.authorization_url);
  } catch (err: any) {
    console.log("PAYSTACK FAILED AGAIN");
    if (err.response) {
      console.log("Status:", err.response.status);
      console.log("Full error →", err.response.data);
    } else {
      console.log("No response →", err.message);
    }
  }
}

testPaystack();