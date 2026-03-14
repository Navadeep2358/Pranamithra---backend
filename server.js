require("dotenv").config();

const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");

const app = express();

/* ================= CORS ================= */
/* allow Netlify + localhost */
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://69b56b6465e26f0008e29d8f--pranamithra-frontend.netlify.app"
  ],
  credentials: true
}));

/* ================= BODY PARSERS ================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= TRUST PROXY (needed for Render) ================= */
app.set("trust proxy", 1);

/* ================= SESSION ================= */
app.use(session({
  name: "pranamithra.sid",
  secret: process.env.SESSION_SECRET || "pranamithra_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "none",   // important for cross-domain cookies
    secure: true        // required when sameSite is none (HTTPS)
  }
}));

/* ================= STATIC UPLOADS ================= */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ================= ROUTES ================= */
app.use("/", authRoutes);
app.use("/api", chatRoutes);

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
const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});