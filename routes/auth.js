const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");

const router = express.Router();

/* ================= CUSTOMER REGISTER ================= */
router.post("/customer/register", async (req, res) => {
  const { fullName, phone, email, password, dob, age, address, gender } = req.body;

  const hash = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO customers (full_name, phone, email, password, dob, age, address, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [fullName, phone, email, hash, dob, age, address, gender],
    err => {
      if (err) return res.status(409).send("Customer already exists");
      res.send("Customer Registration Successful");
    }
  );
});

/* ================= DOCTOR REGISTER ================= */
router.post("/doctor/register", async (req, res) => {
  const { fullName, phone, email, password, hospitalName, specialization } = req.body;

  const hash = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO doctors (full_name, phone, email, password, hospital_name, specialization) VALUES (?, ?, ?, ?, ?, ?)",
    [fullName, phone, email, hash, hospitalName, specialization],
    err => {
      if (err) return res.status(409).send("Doctor already exists");
      res.send("Doctor Registration Successful");
    }
  );
});
/* ================= LOGOUT ================= */ 
router.get("/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).send("Not logged in");
  }
  res.json(req.session.user);
});

/* ================= LOGIN (CUSTOMER / DOCTOR / ADMIN) ================= */
router.post("/login", async (req, res) => {
  const { role, email, password } = req.body;

  if (role === "admin") {
    db.query("SELECT * FROM admin WHERE id = 1", async (_, rows) => {
      const ok = await bcrypt.compare(password, rows[0].password);
      if (!ok) return res.status(401).send("Invalid admin password");

      req.session.user = { role: "admin", name: rows[0].full_name };
      return res.send({ role: "admin", name: rows[0].full_name });
    });
    return;
  }

  const table = role === "customer" ? "customers" : "doctors";

  db.query(
    `SELECT * FROM ${table} WHERE email = ?`,
    [email],
    async (_, rows) => {
      if (rows.length === 0) return res.status(401).send("Invalid credentials");

      const user = rows[0];
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return res.status(401).send("Invalid credentials");

      req.session.user = { role, name: user.full_name };
      res.send({ role, name: user.full_name });
    }
  );
});

module.exports = router;
