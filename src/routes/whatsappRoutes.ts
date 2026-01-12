// Assuming this is in src/routes/whatsappRoutes.ts
import express from 'express';
import { handleWhatsAppMessage } from '../controllers/whatsappController';

const router = express.Router();

// Use urlencoded parser JUST for this webhook route
router.post('/webhook',
  express.urlencoded({ extended: true }),  // extended: true is safer
  handleWhatsAppMessage
);

export default router;
