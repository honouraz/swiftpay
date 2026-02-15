import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  createdAt: { type: Date, default: Date.now },

  role: {
  type: String,
  enum: ["superadmin", "subadmin", "user"],
  default: "user",
},


association: {
  type: String, // e.g. "NASS", "JPS", "MLS"
  default: null,
},

resetToken: {
  type: String,
  default: null
},
resetTokenExpiry: {
  type: Date,
  default: null
}


});


export default mongoose.model("User", userSchema);