import { Router, type IRouter, type Request, type Response } from "express";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

// Logout is now handled client-side by Firebase, 
// but we can provide an endpoint to clear any server-side cookies if necessary.
router.post("/auth/logout", (req: Request, res: Response) => {
  res.clearCookie("sid", { path: "/" });
  res.json({ success: true });
});

export default router;
