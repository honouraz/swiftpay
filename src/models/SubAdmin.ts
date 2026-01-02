// src/models/SubAdmin.ts
import mongoose, { Schema, Document } from "mongoose";

export interface ISubAdmin extends Document {
  name: string;
  email: string;
  password: string;
  role: "subadmin";
  association: string; // ← NEW: "ESAN", "NASS", "SUG", etc
  createdBy: mongoose.Types.ObjectId;
  createdAt?: Date;     // ← optional because Mongoose add am
  updatedAt?: Date;
}

const SubAdminSchema = new Schema<ISubAdmin>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: "subadmin" },
    association: { type: String, required: true }, // ← NEW
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default mongoose.model<ISubAdmin>("SubAdmin", SubAdminSchema);