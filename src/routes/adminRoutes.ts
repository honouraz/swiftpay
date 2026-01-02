import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { createSubAdmin } from "../controllers/adminController";

const router = express.Router();

router.post("/create-subadmin", authMiddleware, createSubAdmin);

export default router;
