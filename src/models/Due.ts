import mongoose, { Schema, Document } from "mongoose";

export interface IDue extends Document {
  name: string;
  description: string;
  prices: {
    "100": number;
    "200": number;
    "300": number;
    "400": number;
    "500": number;
  };
  extraCharge: number;
  platformFeePercent: number;
}

const DueSchema = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  prices: {
    type: Map,
    of: Number,
    default: {
      "100": 0,
      "200": 0,
      "300": 0,
      "400": 0,
      "500": 0,
    },
  },
  extraCharge: { type: Number, default: 0 },
  platformFeePercent: { type: Number, default: 7 },
  // NEW FIELD — PASTE THIS
  flutterwaveSubaccountId: {
    type: String,
    required: false,
  },
  bankName: { type: String, default: "" },          // e.g. "Access Bank"
accountNumber: { type: String, default: "" },
accountName: { type: String, default: "" },       // Verified beneficiary name
}, { timestamps: true });

DueSchema.index({ name: 1 });

export default mongoose.model("Due", DueSchema);