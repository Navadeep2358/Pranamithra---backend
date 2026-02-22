const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");

const app = express();

/* ================= CORS ================= */
app.use(cors({
  origin: ["https://pranamithra-frontend.web.app"],
  credentials: true
}));

/* ================= BODY PARSERS ================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= TRUST PROXY (IMPORTANT FOR RENDER) ================= */
app.set("trust proxy", 1);

/* ================= SESSION ================= */
app.use(session({
  name: "pranamithra.sid",
  secret: "pranamithra_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "none",   // required for cross-site cookies
    secure: true        // MUST be true for HTTPS (Render)
  }
}));

/* ================= STATIC UPLOADS ================= */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ================= ROUTES ================= */
app.use("/", authRoutes);

/* ================= HEALTH CHECK ================= */
app.get("/", (req, res) => {
  res.status(200).send("Backend is running 🚀");
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});