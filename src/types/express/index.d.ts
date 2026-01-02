// src/types/express/index.d.ts
import 'express'; // <- this is critical: we import express to augment it

declare global {
  namespace Express {
    interface User {
      id: string;
      role?: string;
      association?: string;
      email?: string;
    }

    interface Request {
      user?: Express.User & { id: string };
    }
  }
}
