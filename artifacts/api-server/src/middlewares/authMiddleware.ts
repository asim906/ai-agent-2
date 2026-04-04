import { type Request, type Response, type NextFunction } from "express";
import { auth as firebaseAuth } from "@workspace/db";
import type { AuthUser } from "@workspace/api-zod";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;
      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies?.["sid"];

  if (!token) {
    next();
    return;
  }

  try {
    const decodedToken = await firebaseAuth.verifyIdToken(token);
    
    // Map Firebase user to our AuthUser type
    const user: AuthUser = {
      id: decodedToken.uid,
      email: decodedToken.email ?? null,
      firstName: decodedToken.name?.split(" ")[0] ?? null,
      lastName: decodedToken.name?.split(" ").slice(1).join(" ") ?? null,
      profileImageUrl: decodedToken.picture ?? null,
    };

    req.user = user;
    next();
  } catch (error) {
    console.error("Firebase auth error:", error);
    next();
  }
}
