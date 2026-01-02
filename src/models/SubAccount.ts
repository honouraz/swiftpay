import mongoose from "mongoose";

const subAccountSchema = new mongoose.Schema({
  association: { type: String, required: true }, // NASS, SUG, etc
  gateway: { type: String, enum: ["paystack"], required: true }, // Only paystack now
  subAccountCode: { type: String, required: true }, // from Paystack
  splitType: { type: String, enum: ["PERCENT", "FLAT"], default: "PERCENT" },
  splitValue: { type: Number, required: true }, // e.g., 100 = 100%
});

export default mongoose.model("SubAccount", subAccountSchema);