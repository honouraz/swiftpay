import { Request, Response } from "express";
import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export const handleWhatsAppMessage = async (req: Request, res: Response) => {
  const from = req.body.From;      // whatsapp:+234...
  const body = req.body.Body?.trim();

  console.log("Incoming WhatsApp:", from, body);

  let reply = "Welcome to SwiftPay 👋";

  if (!body || body.toLowerCase() === "hi") {
    reply = `Welcome to SwiftPay 👋

1️⃣ Pay Dues
2️⃣ Generate Receipt

Reply with 1 or 2`;
  }

  await client.messages.create({
    from: "whatsapp:+14155238886", // Twilio sandbox number (fixed)
    to: from,
    body: reply,
  });

  res.sendStatus(200);
};
