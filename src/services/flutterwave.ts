import axios from "axios";

export const flw = axios.create({
  baseURL: "https://api.flutterwave.com/v3",
  headers: {
    Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
});

// Initialize Flutterwave payment
export const initializeFlutterwave = async (payload: {
  tx_ref: string;
  amount: number;
  currency: string;
  redirect_url: string;
  customer: { email: string; name?: string; phone_number?: string };
  customizations?: { title?: string; description?: string; logo?: string };
  meta?: any;
}) => {
  const response = await flw.post("/payments", payload);
  return response.data;
};

// Verify Flutterwave payment
export const verifyFlutterwave = async (tx_ref: string) => {
  const response = await flw.get(`/transactions/verify_by_reference?tx_ref=${tx_ref}`);
  return response.data;
};