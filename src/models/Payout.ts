import mongoose from "mongoose";

const PayoutSchema = new mongoose.Schema({
  dueId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Due", 
    required: true 
  },
  associationName: { 
    type: String, 
    required: true 
  },
  totalCollectedBase: { 
    type: Number, 
    default: 0 
  }, // Sum of all baseAmount for this due (association's share)
  totalPaidOut: { 
    type: Number, 
    default: 0 
  },
  pendingAmount: { 
    type: Number, 
    default: 0 
  },
  lastPayoutDate: { type: Date },
  payouts: [{
    amount: { type: Number, required: true },
    reference: { type: String },
    paidAt: { type: Date },
    status: { 
      type: String, 
      enum: ["pending", "success", "failed"], 
      default: "pending" 
    },
    adminNote: { type: String }
  }],
}, { timestamps: true });

export default mongoose.model("Payout", PayoutSchema);