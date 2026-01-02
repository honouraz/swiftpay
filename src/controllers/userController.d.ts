import { Request, Response } from "express";
/**
 * Register a new user
 * POST /api/users/register
 */
export declare const registerUser: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Login user
 * POST /api/users/login
 */
export declare const loginUser: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=userController.d.ts.map