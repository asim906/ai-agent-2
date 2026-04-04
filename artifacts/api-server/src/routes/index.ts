import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import whatsappRouter from "./whatsapp";
import chatsRouter from "./chats";
import aiSettingsRouter from "./ai-settings";
import memoryRouter from "./memory";
import toolsRouter from "./tools";
import analyticsRouter from "./analytics";
import leadsRouter from "./leads";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(whatsappRouter);
router.use(chatsRouter);
router.use(aiSettingsRouter);
router.use(memoryRouter);
router.use(toolsRouter);
router.use(analyticsRouter);
router.use(leadsRouter);

export default router;
