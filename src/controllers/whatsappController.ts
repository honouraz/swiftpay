import { Request, Response } from "express";
import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export const handleWhatsAppMessage = (req: Request, res: Response) => {
  const from = req.body.From;   // whatsapp:+234...
  const body = req.body.Body;   // message text

  console.log("Incoming WhatsApp:", from, body);

  const MessagingResponse = twilio.twiml.MessagingResponse;
  const twiml = new MessagingResponse();

  if (!body || body.toLowerCase() === "hi") {
    twiml.message(
`Welcome to SwiftPay 👋

1️⃣ Pay Dues
2️⃣ Generate Receipt

Reply with 1 or 2`
    );
  } else {
    twiml.message("Invalid option. Reply with 1 or 2.");
  }

  res.set("Content-Type", "text/xml");
  res.send(twiml.toString());
};