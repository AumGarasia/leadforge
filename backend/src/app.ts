import express from "express";
import cors from "cors";
import publicRoutes from "./routes/public";
import authRoutes from "./routes/auth";
import usersRoutes from "./routes/users";
import leadsRoutes from "./routes/leads";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/api/public", publicRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/leads", leadsRoutes);

  // 404 fallback — consistent error shape (NFR)
  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } });
  });

  return app;
}
