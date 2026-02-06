const express = require("express");
const bcrypt = require("bcrypt");
const multer = require("multer");
const path = require("path");
const db = require("../db");

const router = express.Router();

/* ================= MULTER CONFIG ================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

/* ================= CUSTOMER REGISTER ================= */
router.post("/customer/register", async (req, res) => {
  try {
    const { fullName, phone, email, password, dob, age, address, gender } = req.body;
    const hash = await bcrypt.hash(password, 10);

    db.query(
      `INSERT INTO customers 
       (full_name, phone, email, password, dob, age, address, gender)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [fullName, phone, email, hash, dob, age, address, gender],
      err => {
        if (err) return res.status(409).send("Customer already exists");
        res.send("Customer Registration Successful");
      }
    );
  } catch {
    res.status(500).send("Customer registration failed");
  }
});

/* ================= DOCTOR REGISTER ================= */
router.post(
  "/doctor/register",
  upload.fields([
    { name: "doctorImage", maxCount: 1 },
    { name: "hospitalImage", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const {
        fullName,
        phone,
        email,
        password,
        hospitalName,
        specialization
      } = req.body;

      if (!req.files?.doctorImage || !req.files?.hospitalImage) {
        return res.status(400).send("Images are required");
      }

      const doctorImage = req.files.doctorImage[0].filename;
      const hospitalImage = req.files.hospitalImage[0].filename;
      const hash = await bcrypt.hash(password, 10);

      db.query(
        `INSERT INTO doctors 
         (full_name, phone, email, password, hospital_name, specialization, doctor_image, hospital_image)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fullName,
          phone,
          email,
          hash,
          hospitalName,
          specialization,
          doctorImage,
          hospitalImage
        ],
        err => {
          if (err) return res.status(409).send("Doctor already exists");
          res.send("Doctor Registration Successful");
        }
      );
    } catch {
      res.status(500).send("Doctor registration failed");
    }
  }
);

/* ================= LOGIN ================= */
router.post("/login", async (req, res) => {
  const { role, email, password } = req.body;

  /* ===== ADMIN ===== */
  if (role === "admin") {
    db.query("SELECT * FROM admin WHERE id = 1", async (_, rows) => {
      if (!rows.length) return res.status(401).send("Admin not found");

      const ok = await bcrypt.compare(password, rows[0].password);
      if (!ok) return res.status(401).send("Invalid admin password");

      req.session.user = {
        role: "admin",
        name: rows[0].full_name
      };

      return res.json(req.session.user);
    });
    return;
  }

  /* ===== CUSTOMER / DOCTOR ===== */
  const table = role === "customer" ? "customers" : "doctors";

  db.query(
    `SELECT * FROM ${table} WHERE email = ?`,
    [email],
    async (_, rows) => {
      if (!rows.length) return res.status(401).send("Invalid credentials");

      const user = rows[0];
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return res.status(401).send("Invalid credentials");

      req.session.user = {
        role,
        id: user.id,
        name: user.full_name,
        image: role === "doctor" ? user.doctor_image : null // 🔥 FIX
      };

      res.json(req.session.user);
    }
  );
});

/* ================= ME ================= */
router.get("/me", (req, res) => {
  if (!req.session.user) return res.status(401).end();
  res.json(req.session.user);
});

/* ================= LOGOUT ================= */
router.post("/logout", (req, res) => {
  if (!req.session) return res.sendStatus(200);

  req.session.destroy(err => {
    if (err) return res.status(500).send("Logout failed");
    res.clearCookie("connect.sid");
    res.sendStatus(200);
  });
});

module.exports = router;
