const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");

const app = express();

/* ================= CORS ================= */
/* For testing in cloud, allow all origins.
   Later you can restrict to your frontend domain */
app.use(cors({
  origin: true,
  credentials: true
}));

/* ================= BODY PARSERS ================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= SESSION ================= */
app.use(session({
  name: "pranamithra.sid",
  secret: "pranamithra_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false   // Change to true when using HTTPS
  }
}));

/* ================= STATIC UPLOADS ================= */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ================= ROUTES ================= */
app.use("/", authRoutes);

/* ================= HEALTH CHECK ROUTE ================= */
/* Important for GCP Load Balancer */
app.get("/", (req, res) => {
  res.status(200).send("Backend is running 🚀");
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 3000;

/* VERY IMPORTANT: listen on 0.0.0.0 for cloud */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});