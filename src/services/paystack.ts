import axios from "axios";

const paystack = axios.create({
  baseURL: "https://api.paystack.co",
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
});

// Initialize transaction
export const initializePayment = async (email: string, amount: number) => {
  const response = await paystack.post("/transaction/initialize", {
    email,
    amount: amount * 100, // Paystack uses kobo
  });
  return response.data;
};

// Verify payment
export const verifyPayment = async (reference: string) => {
  const response = await paystack.get(`/transaction/verify/${reference}`);
  return response.data;
};
