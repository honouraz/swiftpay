// src/models/Payment.ts — UPDATED WITH COMMISSION & EXTRA CHARGE FIELDS
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },           // total paid (in naira)
  email: { type: String, required: true },
  status: { type: String, 
    enum: ["pending", "success", "failed"],
    default: "success" },

  // Add userId for direct ref
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  // From metadata – what you send from frontend
  payerName: String,
  matricNumber: String,
  department: String,
  phone: String,
  level: String,  // e.g. "100", "200"

  // Breakdown
  baseAmount: { type: Number, default: 0 },         // original due
  platformCommission: { type: Number, default: 0 },  // 5.5% / 4.5%
  extraCharge: { type: Number, default: 0 },        // fixed extra (e.g ESAN)
dueType: { type: String },                         // e.g NASS, SUG, ESAN, FACULTY
association: {
  type: String,
  required: true,
},
paidAt: { type: Date, default: Date.now },
metadata: mongoose.Schema.Types.Mixed,

  confirmed: {
  type: Boolean,
  default: false,
  index: true,
},
confirmedAt: Date,
confirmedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  default: null,
},
qrScans: {
  type: Number,
  default: 0,
},

});

export default mongoose.model("Payment", paymentSchema);