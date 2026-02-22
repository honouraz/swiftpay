// src/controllers/receiptController.ts
import PDFDocument from "pdfkit";
import * as QRCode from "qrcode";
import { Request, Response } from "express";
import Payment from "../models/Payment";
import path from "path";
import fs from "fs";
import crypto from "crypto";

export const generateReceiptBuffer = async (paymentId: string): Promise<Buffer> => {
  return new Promise((resolve) => {
    const fakeReq = { params: { id: paymentId } } as any;
    const chunks: Buffer[] = [];
    const fakeRes = {
      setHeader: () => {},
      write: (chunk: Buffer) => chunks.push(chunk),
      end: () => resolve(Buffer.concat(chunks)),
      status: () => fakeRes,
    };

    generateReceipt(fakeReq, fakeRes as any);
  });
};

const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadReceiptToCloudinary = async (pdfBuffer: Buffer): Promise<any> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { resource_type: 'raw', folder: 'swiftpay/receipts' },
      (error: any, result: unknown) => error ? reject(error) : resolve(result)
    ).end(pdfBuffer);
  });
};

export const generateReceiptByMatric = async (req: Request, res: Response) => {
  try {
    const payment = await Payment.findOne({
      "metadata.matricNumber": req.params.matric,
      status: "success"
    }).sort({ createdAt: -1 });

    if (!payment) return res.status(404).send("Payment not found");

    req.params.id = payment._id.toString();
    return generateReceipt(req, res);

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};


export const generateReceipt = async (req: Request, res: Response) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).send("Payment not found");

    const meta = (payment.metadata as any) || {};
    const dueName = meta.dueName || "SwiftPay Payment";
    const level = meta.level || "N/A";
    const payerName = meta.payerName || "Student";
    const matric = meta.matricNumber || "Unknown";

    const clean = (v: string) => v.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `${clean(dueName)}_${clean(payerName)}_${clean(matric)}.pdf`;

    const receiptSerial = `SP-${payment._id.toString().slice(-6).toUpperCase()}`;

    const hash = crypto
      .createHash("sha256")
      .update(`${payment.reference}${payment.baseAmount}${receiptSerial}`)
      .digest("hex")
      .slice(0, 20);

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    const publicPath = path.join(process.cwd(), "public");

    // ===== BACKGROUND WATERMARK =====
    const bgPath = path.join(publicPath, "receipt-bg.jpg");
    if (fs.existsSync(bgPath)) {
      doc.save();
      doc.opacity(0.9);
      doc.image(bgPath, doc.page.width / 2 - 200, doc.page.height / 2 - 200, {
        width: 400,
      });
      doc.restore();
    }

    // ===== HEADER COLOR PER DUE =====
    let headerColor = "#3F51B5";
    const lowerDue = dueName.toLowerCase();
    if (lowerDue.includes("nass")) headerColor = "#891563ff";
    else if (lowerDue.includes("esan")) headerColor = "#FF5722";
    else if (lowerDue.includes("sossa")) headerColor = "#9C27B0";
    else if (lowerDue.includes("idowu")) headerColor = "#20ef12";

    // ===== HEADER BAR =====
    doc.rect(0, 0, doc.page.width, 140).fill(headerColor);

    doc.fillColor("white").fontSize(14).font("Helvetica-Bold")
      .text("SwiftPay by HON. TECH", 50, 20);

    const swiftLogo = path.join(publicPath, "swiftpay-logo.png");
    if (fs.existsSync(swiftLogo)) {
      doc.image(swiftLogo, 50, 50, { width: 220 });
    }

    const fontPath = path.join(publicPath, "fonts/Roman.ttf");
    if (fs.existsSync(fontPath)) {
      doc.registerFont("Roman", fontPath);
    }

    doc.fillColor("white").fontSize(32).font("Roman")
      .text("SWIFTPAY", 0, 60, { align: "center" });

    doc.fontSize(18).text("Payment Receipt", 0, 100, { align: "center" });

    // ===== ASSOCIATION LOGO =====
    let assocLogo = "";
    if (lowerDue.includes("nass")) assocLogo = "Nass.png";
    else if (lowerDue.includes("sug")) assocLogo = "sug.png";
    else if (lowerDue.includes("idowu")) assocLogo = "idowu.png";

    if (assocLogo && fs.existsSync(path.join(publicPath, assocLogo))) {
      doc.image(path.join(publicPath, assocLogo), doc.page.width - 180, 20, { width: 140 });
    }

    // ===== DETAILS =====
    let y = 200;
    const field = (label: string, value: string) => {
      doc.fillColor("black").fontSize(16).font("Helvetica-Bold")
        .text(label + ":", 70, y);
      doc.font("Roman").fontSize(16).text(value, 240, y);
      y += 40;
    };

    field("Receipt No", receiptSerial);
    field("Student Name", payerName);
    field("Matric Number", matric);
    field("Department", meta.department || "N/A");
    field("Level", level);
    field("Phone", meta.phone || "N/A");
    field("Payment For", dueName);
    field("Reference", payment.reference);
    field("Amount", `₦${payment.baseAmount.toLocaleString()}`);

    const statusMap: any = {
      success: { label: "SUCCESSFUL", color: "#2E7D32" },
      pending: { label: "PENDING", color: "#F9A825" },
      failed: { label: "FAILED", color: "#C62828" },
      cancelled: { label: "CANCELLED", color: "#6D4C41" },
    };

    const status = statusMap[payment.status] || statusMap.pending;
    doc.fillColor(status.color).fontSize(16).font("Helvetica-Bold")
      .text("Status:", 70, y);
    doc.font("Roman").text(status.label, 240, y);
    y += 40;

    field(
      "Date",
      new Date(payment.paidAt || Date.now()).toLocaleString("en-GB").replace(",", "")
    );

    // ===== AMOUNT BOX =====
    y += 20;
    doc.roundedRect(70, y, doc.page.width - 140, 80, 25).fill(headerColor);
    doc.fillColor("white").fontSize(18).font("Roman")
      .text("Amount Paid", 90, y + 20);
    doc.fontSize(40)
      .text(`₦${payment.baseAmount.toLocaleString()}`, 90, y + 45);

    // ===== QR CODE =====
    const verifyUrl = `${process.env.FRONTEND_URL}/verify/${payment._id}`;
    const qrData = await QRCode.toDataURL(verifyUrl);
    const qrBuffer = Buffer.from(qrData.split(",")[1], "base64");
    doc.image(qrBuffer, doc.page.width - 150, doc.page.height - 190, { width: 110 });
    doc.fontSize(9).fillColor("black")
      .text("Scan to verify authenticity", doc.page.width - 170, doc.page.height - 70);

    // ===== DIGITAL SIGNATURE =====
    const signPath = path.join(publicPath, "signature.png");
    if (fs.existsSync(signPath)) {
      doc.image(signPath, 70, doc.page.height - 170, { width: 120 });
      doc.fontSize(10).fillColor("black")
        .text("Authorized Signatory", 70, doc.page.height - 45);
    }

    // ===== SECURITY TEXT =====
    doc.fontSize(8).fillColor("gray")
      .text(`SHA-256: ${hash}`, 70, doc.page.height - 80);

    doc.fontSize(7).fillColor("gray")
      .text(
        "Generated on SwiftPay • Secure • Verifiable • Tamper-Proof",
        0,
        doc.page.height - 20,
        { align: "center", width: doc.page.width }
      );

    doc.fontSize(14).fillColor("black").font("Helvetica-Bold")
      .text("Powered by SwiftPay", 0, doc.page.height - 60, {
        align: "center",
        width: doc.page.width,
      });

    doc.end();
  } catch (err) {
    console.error("PDF ERROR:", err);
    if (!res.headersSent) res.status(500).send("Failed to generate receipt");
  }
};
