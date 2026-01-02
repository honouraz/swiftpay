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

export {};