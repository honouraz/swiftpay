// src/models/Conversation.ts
import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  waId: { type: String, required: true, unique: true }, // "2348127327090"
  currentStep: { type: String, default: 'idle' }, // 'idle', 'collect_name', 'collect_matric', 'collect_phone', 'collect_email', 'choose_dept', 'choose_due', 'choose_level', 'payment_pending'
  data: { type: Object, default: {} }, // { name: "...", matric: "...", phone: "...", email: "...", dept: "...", dueId: "...", level: "..." }
  lastUpdated: { type: Date, default: Date.now }
});

export default mongoose.model('Conversation', conversationSchema);