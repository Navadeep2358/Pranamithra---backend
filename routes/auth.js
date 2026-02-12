const express = require("express");
const bcrypt = require("bcrypt");
const multer = require("multer");
const path = require("path");
const db = require("../db");

const router = express.Router();

/* ================= MULTER CONFIG ================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

/* ================= CUSTOMER REGISTER ================= */
router.post("/customer/register", async (req, res) => {
  try {
    const {
      fullName,
      phone,
      email,
      password,
      dob,
      age,
      address,
      gender
    } = req.body;

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
         (full_name, phone, email, password, hospital_name,
          specialization, doctor_image, hospital_image, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
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

  /* ===== ADMIN LOGIN ===== */
  if (role === "admin") {
    if (email !== "admin@gmail.com" || password !== "422627") {
      return res.status(401).send("Invalid admin credentials");
    }

    req.session.user = { role: "admin", name: "Admin" };
    return res.json(req.session.user);
  }

  /* ===== CUSTOMER / DOCTOR LOGIN ===== */
  const table = role === "customer" ? "customers" : "doctors";

  db.query(
    `SELECT * FROM ${table} WHERE email = ?`,
    [email],
    async (err, rows) => {
      if (err || !rows.length)
        return res.status(401).send("Invalid credentials");

      const user = rows[0];
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return res.status(401).send("Invalid credentials");

      req.session.user = {
        role,
        id: user.id,
        name: user.full_name,
        image: role === "doctor" ? user.doctor_image : null,
        status: role === "doctor" ? user.status : null
      };

      res.json(req.session.user);
    }
  );
});

/* ================= SESSION CHECK ================= */
router.get("/me", (req, res) => {
  if (!req.session.user) return res.status(401).end();
  res.json(req.session.user);
});

/* ================= LOGOUT ================= */
router.post("/logout", (req, res) => {
  if (!req.session) return res.sendStatus(200);

  req.session.destroy(err => {
    if (err) return res.status(500).send("Logout failed");
    res.clearCookie("pranamithra.sid");
    res.sendStatus(200);
  });
});

/* ===================================================
   =============== ADMIN – VERIFY DOCTOR ===============
   =================================================== */

/* GET all pending doctors */
router.get("/admin/doctors/pending", (req, res) => {
  db.query(
    "SELECT id, full_name FROM doctors WHERE status = 'PENDING'",
    (err, rows) => {
      if (err) return res.status(500).send("Server error");
      res.json(rows);
    }
  );
});

/* GET doctor full details */
router.get("/admin/doctors/:id", (req, res) => {
  db.query(
    "SELECT * FROM doctors WHERE id = ?",
    [req.params.id],
    (err, rows) => {
      if (err || !rows.length)
        return res.status(404).send("Doctor not found");
      res.json(rows[0]);
    }
  );
});

/* VERIFY doctor */
router.post("/admin/doctors/verify/:id", (req, res) => {
  db.query(
    "UPDATE doctors SET status = 'VERIFIED' WHERE id = ?",
    [req.params.id],
    err => {
      if (err) return res.status(500).send("Failed");
      res.send("Doctor verified");
    }
  );
});

/* REJECT doctor */
router.post("/admin/doctors/reject/:id", (req, res) => {
  db.query(
    "UPDATE doctors SET status = 'REJECTED' WHERE id = ?",
    [req.params.id],
    err => {
      if (err) return res.status(500).send("Failed");
      res.send("Doctor rejected");
    }
  );
});

/* ===================================================
   ============ ADMIN – DATABASE APIS =================
   =================================================== */

/* ALL DOCTORS */
router.get("/admin/doctors", (req, res) => {
  db.query("SELECT * FROM doctors", (err, rows) => {
    if (err) return res.status(500).send("Server error");
    res.json(rows);
  });
});

/* ALL CUSTOMERS */
router.get("/admin/customers", (req, res) => {
  db.query("SELECT * FROM customers", (err, rows) => {
    if (err) return res.status(500).send("Server error");
    res.json(rows);
  });
});

/* ================= GET PROFILE ================= */
router.get("/profile", (req, res) => {
  if (!req.session.user)
    return res.status(401).send("Unauthorized");

  const { role, id } = req.session.user;
  const table = role === "customer" ? "customers" : "doctors";

  db.query(
    `SELECT * FROM ${table} WHERE id = ?`,
    [id],
    (err, rows) => {
      if (err || !rows.length)
        return res.status(500).send("Profile not found");

      const user = rows[0];
      delete user.password;

      user.role = role; // IMPORTANT

      res.json(user);
    }
  );
});

/* ================= UPDATE PROFILE ================= */
router.put(
  "/profile",
  upload.fields([
    { name: "doctor_image", maxCount: 1 },
    { name: "hospital_image", maxCount: 1 }
  ]),
  (req, res) => {

    if (!req.session.user)
      return res.status(401).send("Unauthorized");

    const { role, id } = req.session.user;
    const body = req.body;

    if (role === "customer") {
      db.query(
        `UPDATE customers
         SET full_name=?, phone=?, dob=?, age=?, address=?, gender=?
         WHERE id=?`,
        [
          body.full_name,
          body.phone,
          body.dob,
          body.age,
          body.address,
          body.gender,
          id
        ],
        err => {
          if (err) return res.status(500).send("Update failed");
          res.send("Updated");
        }
      );
    }

    if (role === "doctor") {

      let doctorImage = req.files?.doctor_image
        ? req.files.doctor_image[0].filename
        : body.doctor_image;

      let hospitalImage = req.files?.hospital_image
        ? req.files.hospital_image[0].filename
        : body.hospital_image;

      db.query(
        `UPDATE doctors
         SET full_name=?, phone=?, hospital_name=?, specialization=?,
             doctor_image=?, hospital_image=?
         WHERE id=?`,
        [
          body.full_name,
          body.phone,
          body.hospital_name,
          body.specialization,
          doctorImage,
          hospitalImage,
          id
        ],
        err => {
          if (err) return res.status(500).send("Update failed");
          res.send("Updated");
        }
      );
    }
  }
);

/* ================= CHANGE PASSWORD ================= */
router.put("/change-password", async (req, res) => {
  if (!req.session.user)
    return res.status(401).send("Unauthorized");

  const { role, id } = req.session.user;
  const { currentPassword, newPassword } = req.body;
  const table = role === "customer" ? "customers" : "doctors";

  db.query(
    `SELECT password FROM ${table} WHERE id=?`,
    [id],
    async (err, rows) => {
      if (err || !rows.length)
        return res.status(500).send("User not found");

      const match = await bcrypt.compare(
        currentPassword,
        rows[0].password
      );

      if (!match)
        return res.status(400).send("Current password incorrect");

      const hash = await bcrypt.hash(newPassword, 10);

      db.query(
        `UPDATE ${table} SET password=? WHERE id=?`,
        [hash, id],
        err => {
          if (err)
            return res.status(500).send("Password update failed");
          res.send("Password changed");
        }
      );
    }
  );
});


module.exports = router;
