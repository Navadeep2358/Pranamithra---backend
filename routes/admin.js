const express = require("express");
const db = require("../db");
const router = express.Router();

/* ===== SESSION CHECK ===== */
const auth = (req, res, next) => {
  if (!req.session.user) return res.sendStatus(401);
  next();
};

/* ===== PERMISSION CHECK ===== */
const allow = perm => (req, res, next) => {
  if (req.session.user.role === "MAIN_ADMIN") return next();
  if (req.session.user.permissions?.[perm]) return next();
  res.status(403).send("You have no access");
};

/* ===== VERIFY DOCTOR ===== */
router.put("/verify-doctor/:id", auth, allow("verifyDoctor"), (req, res) => {
  db.query(
    "UPDATE doctors SET verified = 1 WHERE id = ?",
    [req.params.id],
    () => res.send("Doctor verified")
  );
});

/* ===== DOCTORS DATABASE ===== */
router.get("/doctors", auth, allow("doctorDb"), (req, res) => {
  db.query("SELECT * FROM doctors", (_, rows) => res.json(rows));
});

/* ===== DELETE DOCTOR ===== */
router.delete("/doctor/:id", auth, allow("doctorDb"), (req, res) => {
  db.query("DELETE FROM doctors WHERE id = ?", [req.params.id], () => {
    res.send("Doctor deleted");
  });
});

/* ===== CUSTOMERS DATABASE ===== */
router.get("/customers", auth, allow("customerDb"), (req, res) => {
  db.query("SELECT * FROM customers", (_, rows) => res.json(rows));
});

module.exports = router;
