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
    const { fullName, phone, email, password, dob, age, address, gender } =
      req.body;

    const hash = await bcrypt.hash(password, 10);

    db.query(
      `INSERT INTO customers 
      (full_name, phone, email, password, dob, age, address, gender)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [fullName, phone, email, hash, dob, age, address, gender],
      (err) => {
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
        specialization,
        experience     // 🔥 NEW
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
         specialization, experience, doctor_image, hospital_image, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [
          fullName,
          phone,
          email,
          hash,
          hospitalName,
          specialization,
          experience,      // 🔥 SAVED HERE
          doctorImage,
          hospitalImage
        ],
        (err) => {
          if (err) {
            console.error(err);
            return res.status(409).send("Doctor already exists");
          }
          res.send("Doctor Registration Successful");
        }
      );

    } catch (err) {
      console.error(err);
      res.status(500).send("Doctor registration failed");
    }
  }
);

/* ================= LOGIN ================= */
router.post("/login", async (req, res) => {
  const { role, email, password } = req.body;

  if (role === "admin") {
    if (email !== "admin@gmail.com" || password !== "422627") {
      return res.status(401).send("Invalid admin credentials");
    }

    req.session.user = { role: "admin", name: "Admin" };
    return res.json(req.session.user);
  }

  const table = role === "customer" ? "customers" : "doctors";

  db.query(
    `SELECT * FROM ${table} WHERE email=?`,
    [email],
    async (err, rows) => {
      if (err || !rows.length)
        return res.status(401).send("Invalid credentials");

      const user = rows[0];
      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).send("Invalid credentials");

      // 🔥 IMAGE FIX ADDED
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
  req.session.destroy(() => {
    res.clearCookie("pranamithra.sid");
    res.sendStatus(200);
  });
});

/* ================= GET PROFILE ================= */
router.get("/profile", (req, res) => {

  if (!req.session.user)
    return res.status(401).send("Unauthorized");

  const { role, id } = req.session.user;
  const table = role === "customer" ? "customers" : "doctors";

  db.query(
    `SELECT * FROM ${table} WHERE id=?`,
    [id],
    (err, rows) => {

      if (err || !rows.length)
        return res.status(500).send("Profile not found");

      const user = rows[0];
      delete user.password;

      user.role = role;

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

    /* ================= CUSTOMER UPDATE ================= */
    if (role === "customer") {

      let { full_name, phone, dob, age, address, gender } = req.body;

      if (dob) dob = dob.split("T")[0];

      db.query(
        `UPDATE customers 
         SET full_name=?, phone=?, dob=?, age=?, address=?, gender=? 
         WHERE id=?`,
        [full_name, phone, dob, age, address, gender, id],
        (err) => {

          if (err) {
            console.error(err);
            return res.status(500).send("Customer update failed");
          }

          res.send("Customer updated successfully");
        }
      );
    }

    /* ================= DOCTOR UPDATE ================= */
    else if (role === "doctor") {

      const {
        full_name,
        phone,
        hospital_name,
        specialization,
        experience      // 🔥 VERY IMPORTANT
      } = req.body;

      console.log("Updating Experience:", experience); // Debug

      let doctorImage = req.files?.doctor_image
        ? req.files.doctor_image[0].filename
        : req.body.doctor_image;

      let hospitalImage = req.files?.hospital_image
        ? req.files.hospital_image[0].filename
        : req.body.hospital_image;

      db.query(
        `UPDATE doctors 
         SET full_name=?,
             phone=?,
             hospital_name=?,
             specialization=?,
             experience=?,      -- 🔥 FIXED
             doctor_image=?,
             hospital_image=? 
         WHERE id=?`,
        [
          full_name,
          phone,
          hospital_name,
          specialization,
          experience || 0,
          doctorImage,
          hospitalImage,
          id
        ],
        (err) => {

          if (err) {
            console.error(err);
            return res.status(500).send("Doctor update failed");
          }

          // 🔥 Update session image instantly
          req.session.user.image = doctorImage;

          res.send("Doctor updated successfully");
        }
      );
    }
  }
);

/* ================= CHANGE PASSWORD (ADDED) ================= */
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
        (err) => {
          if (err)
            return res.status(500).send("Password update failed");

          res.send("Password changed successfully");
        }
      );
    }
  );
});

/* ================= ADMIN ROUTES (UNCHANGED) ================= */
// (All your admin routes stay exactly same here)

/* ================= ADMIN ROUTES ================= */

router.get("/admin/doctors/pending", (req, res) => {
  db.query(
    "SELECT id, full_name FROM doctors WHERE status='PENDING'",
    (err, rows) => {
      if (err) return res.status(500).send("Server error");
      res.json(rows);
    }
  );
});

router.get("/admin/doctors/:id", (req, res) => {
  db.query(
    "SELECT * FROM doctors WHERE id=?",
    [req.params.id],
    (err, rows) => {
      if (err || !rows.length)
        return res.status(404).send("Doctor not found");
      res.json(rows[0]);
    }
  );
});

router.post("/admin/doctors/verify/:id", (req, res) => {
  db.query(
    "UPDATE doctors SET status='VERIFIED' WHERE id=?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).send("Failed");
      res.send("Doctor verified");
    }
  );
});

router.post("/admin/doctors/reject/:id", (req, res) => {
  db.query(
    "UPDATE doctors SET status='REJECTED' WHERE id=?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).send("Failed");
      res.send("Doctor rejected");
    }
  );
});

router.get("/admin/doctors", (req, res) => {
  db.query("SELECT * FROM doctors", (err, rows) => {
    if (err) return res.status(500).send("Server error");
    res.json(rows);
  });
});

router.get("/admin/customers", (req, res) => {
  db.query("SELECT * FROM customers", (err, rows) => {
    if (err) return res.status(500).send("Server error");
    res.json(rows);
  });
});

/* ================= SLOT GENERATOR WITH 5 MIN GAP ================= */
function generateSlots(loginTime, logoutTime, duration) {
  let slots = [];

  const start = new Date(`1970-01-01T${loginTime}:00`);
  const end = new Date(`1970-01-01T${logoutTime}:00`);

  let current = start;

  const gap = 5; // 🔥 5 Minutes Gap After Each Appointment

  while (current < end) {

    let slotEnd = new Date(current.getTime() + duration * 60000);

    if (slotEnd > end) break;

    const startStr = current.toTimeString().slice(0, 5);
    const endStr = slotEnd.toTimeString().slice(0, 5);

    slots.push(`${startStr} - ${endStr}`);

    // 🔥 Move to next slot WITH gap
    current = new Date(slotEnd.getTime() + gap * 60000);
  }

  return slots;
}

/* ================= DOCTOR SCHEDULE SAVE / UPDATE ================= */
router.post("/doctor/schedule", (req, res) => {

  if (!req.session.user || req.session.user.role !== "doctor")
    return res.status(401).send("Unauthorized");

  const { loginTime, logoutTime, duration } = req.body;
  const doctorId = req.session.user.id;

  if (!loginTime || !logoutTime || !duration)
    return res.status(400).send("Missing fields");

  const slotDuration = Number(duration);

  // ✅ Only allow 10, 20, 30 minutes
  if (![10, 20, 30].includes(slotDuration))
    return res.status(400).send("Invalid slot duration");

  // 🔥 Automatically generate slots
  const availableSlots = generateSlots(
    loginTime,
    logoutTime,
    slotDuration
  );

  db.query(
    `INSERT INTO doctor_schedules
     (doctor_id, login_time, logout_time, duration, available_slots)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       login_time = VALUES(login_time),
       logout_time = VALUES(logout_time),
       duration = VALUES(duration),
       available_slots = VALUES(available_slots),
       created_at = NOW()
    `,
    [
      doctorId,
      loginTime,
      logoutTime,
      slotDuration,
      JSON.stringify(availableSlots)
    ],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Schedule save failed");
      }

      res.send("Schedule saved successfully");
    }
  );
});


/* ================= GET DOCTOR SCHEDULE ================= */
router.get("/doctor/schedule/:doctorId", (req, res) => {

  db.query(
    "SELECT * FROM doctor_schedules WHERE doctor_id=? LIMIT 1",
    [req.params.doctorId],
    (err, rows) => {

      if (err) return res.status(500).send("Database error");
      if (!rows.length) return res.status(404).send("No schedule");

      const schedule = rows[0];

      schedule.available_slots =
        typeof schedule.available_slots === "string"
          ? JSON.parse(schedule.available_slots)
          : schedule.available_slots;

      res.json(schedule);
    }
  );
});

/* ================= SAVE / UPDATE APPOINTMENT COST ================= */
router.post("/doctor/appointment-cost", (req, res) => {

  if (!req.session.user || req.session.user.role !== "doctor")
    return res.status(401).send("Unauthorized");

  const doctorId = req.session.user.id;
  const { cost10, cost20, cost30 } = req.body;

  if (!cost10 || !cost20 || !cost30)
    return res.status(400).send("All fields required");

  db.query(
    `INSERT INTO doctor_appointment_costs
     (doctor_id, cost_10, cost_20, cost_30)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       cost_10 = ?,
       cost_20 = ?,
       cost_30 = ?`,
    [
      doctorId,
      cost10,
      cost20,
      cost30,
      cost10,
      cost20,
      cost30
    ],
    (err) => {
      if (err) {
        console.error("DB ERROR:", err);   // 🔥 IMPORTANT
        return res.status(500).send("Failed to save cost");
      }

      res.send("Appointment cost saved successfully");
    }
  );
});


/* ================= GET APPOINTMENT COST ================= */
router.get("/doctor/appointment-cost/:doctorId", (req, res) => {

  db.query(
    "SELECT * FROM doctor_appointment_costs WHERE doctor_id=?",
    [req.params.doctorId],
    (err, rows) => {

      if (err) return res.status(500).send("Database error");

      if (!rows.length) return res.json(null);

      res.json(rows[0]);
    }
  );
});

/* ================= GET VERIFIED DOCTORS ================= */
router.get("/customer/doctors", (req, res) => {
  db.query(
    "SELECT id, full_name, specialization, experience, hospital_name, doctor_image FROM doctors WHERE status='VERIFIED'",
    (err, rows) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Server error");
      }
      console.log("Doctors returned:", rows); // 🔥 DEBUG LINE
      res.json(rows);
    }
  );
});


module.exports = router;
