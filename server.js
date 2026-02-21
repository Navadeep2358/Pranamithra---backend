const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");

const app = express();

/* ========================= CORS ========================= */
app.use(cors({
  origin: true,              // allow ALB domain dynamically
  credentials: true
}));

/* ====================== BODY PARSERS ===================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ======================= SESSION ========================= */
app.use(session({
  name: "pranamithra.sid",
  secret: "pranamithra_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,          // false because using HTTP (ALB without HTTPS)
    sameSite: "lax"
  }
}));

/* ===================== STATIC UPLOADS ==================== */
/* Accessible as: http://ALB-DNS/api/uploads/filename.jpg */
app.use("/api/uploads", express.static(path.join(__dirname, "uploads")));

/* ===================== HEALTH CHECK ====================== */
/* Used by ALB Target Group Health Check */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

/* ========================= ROUTES ======================== */
/* All backend routes MUST start with /api */
app.use("/api", authRoutes);

/* ========================= SERVER ======================== */
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});