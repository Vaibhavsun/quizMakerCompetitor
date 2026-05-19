import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import userRouter from "./src/modules/user/user.routes.js";
import roomRouter from "./src/modules/room/room.routes.js";
import "./src/modules/socket/index.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// Comma-separated list, or "*" for any origin. Defaults to localhost dev origins.
const CORS_ORIGIN = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map(s => s.trim())
    : ["http://localhost:3000", "http://localhost:5173"];

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.send("<p> vaibhav is a good boy</p>");
});

app.use("/user", userRouter);
app.use("/room", roomRouter);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${PORT}`);
});
