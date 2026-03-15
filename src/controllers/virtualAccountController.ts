import axios from "axios";
import Payment from "../models/Payment";

export const createVirtualAccount = async (req: any, res: any) => {
  try {
    const { email, dueId, amount, reference } = req.body;

    const response = await axios.post(
      "https://api.flutterwave.com/v3/virtual-account-numbers",
      {
        email,
        is_permanent: false,
        tx_ref: reference,
        amount,
        currency: "NGN",
        narration: "SwiftPay Payment",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const va = response.data.data;

    await Payment.findOneAndUpdate(
      { reference },
      {
        virtualAccount: {
          accountNumber: va.account_number,
          bankName: va.bank_name,
          accountName: va.account_name,
          flwRef: va.flw_ref
        }
      }
    );

    res.json({
      accountNumber: va.account_number,
      bankName: va.bank_name,
      accountName: va.account_name,
      amount
    });

  } catch (err) {
    if (err && typeof err === "object" && "response" in err) {
      // @ts-ignore
      console.error("VA creation error:", err.response?.data);
    } else {
      console.error("VA creation error:", err);
    }
    res.status(500).json({ message: "VA creation failed" });
  }
};
