require("dotenv").config();

const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");

const app = express();

/* ================= CORS ================= */
app.use(cors({
  origin: [
    "http://localhost:5173",  // Vite frontend
    "https://pranamithra-frontend.web.app"
  ],
  credentials: true
}));

/* ================= BODY PARSERS ================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= TRUST PROXY ================= */
app.set("trust proxy", 1);

/* ================= SESSION ================= */
app.use(session({
  name: "pranamithra.sid",
  secret: "pranamithra_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",   // local development
    secure: false      // set true only in production (HTTPS)
  }
}));

/* ================= STATIC UPLOADS ================= */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ================= ROUTES ================= */
app.use("/", authRoutes);      // login, admin, etc.
app.use("/api", chatRoutes);   // chatbot route

/* ================= HEALTH CHECK ================= */
app.get("/", (req, res) => {
  res.status(200).send("Backend is running 🚀");
});

/* ================= ERROR HANDLER ================= */
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});

/* ================= SERVER ================= */
const PORT = 3000;   // ✅ KEEP 3000 (matches frontend)

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});