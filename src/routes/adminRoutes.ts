import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { createSubAdmin } from "../controllers/adminController";
import { Router, Request, Response } from "express";

const router = express.Router();

router.post("/create-subadmin", authMiddleware, createSubAdmin);

export default router;
