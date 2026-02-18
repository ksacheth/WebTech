import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import prisma from "@repo/database";

const app: Express = express();
const PORT = process.env.PORT ?? 4000;

// ─── Global Middleware ──────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:3000" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ───────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── API Routes (to be added) ────────────────────────────────────────────────
app.get("/api/users", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// import authRouter    from "./routes/auth.js";
// import examRouter    from "./routes/exam.js";
// import submitRouter  from "./routes/submission.js";
// import proctorRouter from "./routes/proctoring.js";
//
// app.use("/api/auth",        authRouter);
// app.use("/api/exams",       examRouter);
// app.use("/api/submissions", submitRouter);
// app.use("/api/proctoring",  proctorRouter);

// ─── 404 Handler ────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start Server ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[api] Server running at http://localhost:${PORT}`);
});

export default app;
