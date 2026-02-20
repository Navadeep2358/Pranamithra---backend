const express = require("express");
const bcrypt = require("bcrypt");
const multer = require("multer");
const path = require("path");
const db = require("../db");
const { v4: uuidv4 } = require("uuid");


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
        hospitalAddress,   // ✅ NEW
        specialization,
        experience
      } = req.body;

      if (!req.files?.doctorImage || !req.files?.hospitalImage) {
        return res.status(400).send("Images are required");
      }

      const doctorImage = req.files.doctorImage[0].filename;
      const hospitalImage = req.files.hospitalImage[0].filename;
      const hash = await bcrypt.hash(password, 10);

      db.query(
        `INSERT INTO doctors 
        (full_name, phone, email, password, hospital_name, hospital_address,
         specialization, experience, doctor_image, hospital_image, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [
          fullName,
          phone,
          email,
          hash,
          hospitalName,
          hospitalAddress,
          specialization,
          experience,
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
    hospital_address,   // ✅ NEW
    specialization,
    experience
  } = req.body;

  console.log("Updating Experience:", experience);

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
         hospital_address=?,    -- ✅ NEW
         specialization=?,
         experience=?,
         doctor_image=?,
         hospital_image=? 
     WHERE id=?`,
    [
      full_name,
      phone,
      hospital_name,
      hospital_address,
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

/* ================= My Schedules ================= */
router.get("/doctor/my-schedules", (req, res) => {

  if (!req.session.user || req.session.user.role !== "doctor")
    return res.status(401).send("Unauthorized");

  db.query(
    `SELECT * FROM doctor_schedules 
     WHERE doctor_id=? 
     ORDER BY schedule_date ASC`,
    [req.session.user.id],
    (err, rows) => {

      if (err) return res.status(500).send("Error");

      rows.forEach(r => {
        r.available_slots =
          typeof r.available_slots === "string"
            ? JSON.parse(r.available_slots)
            : r.available_slots;
      });

      res.json(rows);
    }
  );
});

/* ================= SLOT GENERATOR WITH 5 MIN GAP ================= */
function generateSlots(loginTime, logoutTime, duration) {

  let slots = [];

  const start = new Date(`1970-01-01T${loginTime}:00`);
  const end = new Date(`1970-01-01T${logoutTime}:00`);

  let current = start;
  const gap = 5;

  const formatTime = (date) => {
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "pm" : "am";

    hours = hours % 12;
    hours = hours ? hours : 12;

    return `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
  };

  while (current < end) {

    let slotEnd = new Date(current.getTime() + duration * 60000);
    if (slotEnd > end) break;

    const startStr = formatTime(current);
    const endStr = formatTime(slotEnd);

    slots.push(`${startStr} - ${endStr}`);

    current = new Date(slotEnd.getTime() + gap * 60000);
  }

  return slots;
}

/* ================= GENERATE SLOT PREVIEW ================= */
router.post("/doctor/generate-slots", (req, res) => {

  const { loginTime, logoutTime, duration } = req.body;

  if (!loginTime || !logoutTime || !duration)
    return res.status(400).send("Missing fields");

  const slotDuration = Number(duration);

  if (![10, 20, 30].includes(slotDuration))
    return res.status(400).send("Invalid duration");

  const generatedSlots = generateSlots(loginTime, logoutTime, slotDuration);

  if (generatedSlots.length === 0)
    return res.status(400).send("No slots generated");

  res.json(generatedSlots);   // 🔥 Only preview
});

/* ================= SAVE DOCTOR SELECTED SLOTS ================= */
router.post("/doctor/schedule", (req, res) => {

  if (!req.session.user || req.session.user.role !== "doctor")
    return res.status(401).send("Unauthorized");

  const {
    scheduleDate,
    loginTime,
    logoutTime,
    duration,
    selectedSlots
  } = req.body;

  const doctorId = req.session.user.id;

  if (!scheduleDate || !loginTime || !logoutTime || !duration)
    return res.status(400).send("Missing fields");

  if (!Array.isArray(selectedSlots) || selectedSlots.length === 0)
    return res.status(400).send("Please select at least one slot");

  db.query(
    `INSERT INTO doctor_schedules
     (doctor_id, schedule_date, login_time, logout_time, duration, available_slots)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       login_time = VALUES(login_time),
       logout_time = VALUES(logout_time),
       duration = VALUES(duration),
       available_slots = VALUES(available_slots),
       created_at = NOW()`,
    [
      doctorId,
      scheduleDate,
      loginTime,
      logoutTime,
      duration,
      JSON.stringify(selectedSlots)
    ],
    (err) => {

      if (err) {
        console.error("Schedule Save Error:", err);
        return res.status(500).send("Schedule save failed");
      }

      res.send("Schedule saved successfully");
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

      if (err) {
        console.error(err);
        return res.status(500).send("Database error");
      }

      if (!rows.length) return res.json(null);

      res.json(rows[0]);
    }
  );
});


/* ================= GET VERIFIED DOCTORS ================= */
router.get("/customer/doctors", (req, res) => {

  db.query(
    `SELECT id, full_name, specialization, experience, 
            hospital_name, hospital_address, doctor_image 
     FROM doctors 
     WHERE status='VERIFIED'`,
    (err, rows) => {

      if (err) {
        console.error(err);
        return res.status(500).send("Server error");
      }

      res.json(rows);
    }
  );
});


/* ================= GET SINGLE VERIFIED DOCTOR ================= */
router.get("/customer/doctor/:id", (req, res) => {

  db.query(
    `SELECT id, full_name, specialization, experience,
            hospital_name, hospital_address, doctor_image
     FROM doctors
     WHERE id=? AND status='VERIFIED'`,
    [req.params.id],
    (err, rows) => {

      if (err) {
        console.error(err);
        return res.status(500).send("Database error");
      }

      if (!rows.length)
        return res.status(404).send("Doctor not found");

      res.json(rows[0]);
    }
  );
});

/* ================= GET AVAILABLE SLOTS (FINAL FIX) ================= */
router.get("/doctor/available-slots", (req, res) => {

  const { doctorId, date } = req.query;

  if (!doctorId || !date) {
    return res.json([]);
  }

  db.query(
    `SELECT available_slots 
     FROM doctor_schedules
     WHERE doctor_id=? 
     AND DATE(schedule_date)=?`,
    [doctorId, date],
    (err, rows) => {

      if (err) {
        console.error("Schedule Error:", err);
        return res.json([]);
      }

      if (!rows.length) {
        return res.json([]);
      }

      let allSlots = rows[0].available_slots;

      if (typeof allSlots === "string") {
        try {
          allSlots = JSON.parse(allSlots);
        } catch (e) {
          console.error("JSON parse error:", e);
          return res.json([]);
        }
      }

      db.query(
        `SELECT slot_time 
         FROM appointments
         WHERE doctor_id=? 
         AND appointment_date=?`,
        [doctorId, date],
        (err2, bookedRows) => {

          if (err2) {
            console.error("Booked Error:", err2);
            return res.json([]);
          }

          const bookedSlots = bookedRows.map(r => r.slot_time);

          const availableSlots = allSlots.filter(
            slot => !bookedSlots.includes(slot)
          );

          res.json(availableSlots);
        }
      );
    }
  );
});

/* ================= BOOK APPOINTMENT (FINAL FIX) ================= */
router.post("/book-appointment", (req, res) => {

  if (!req.session.user || req.session.user.role !== "customer")
    return res.status(401).send("Unauthorized");

  const { doctorId, slotTime, duration, amount, date } = req.body;
  const customerId = req.session.user.id;

  if (!doctorId || !slotTime || !duration || !date)
    return res.status(400).send("Missing fields");

  db.query(
    `SELECT available_slots 
     FROM doctor_schedules
     WHERE doctor_id=? 
     AND DATE(schedule_date)=?`,
    [doctorId, date],
    (err, rows) => {

      if (err) {
        console.error(err);
        return res.status(500).send("Database error");
      }

      if (!rows.length)
        return res.status(400).send("Doctor not scheduled");

      let scheduledSlots = rows[0].available_slots;

      if (typeof scheduledSlots === "string") {
        scheduledSlots = JSON.parse(scheduledSlots);
      }

      if (!scheduledSlots.includes(slotTime))
        return res.status(400).send("Invalid slot");

      db.query(
        `SELECT id FROM appointments 
         WHERE doctor_id=? 
         AND appointment_date=? 
         AND slot_time=?`,
        [doctorId, date, slotTime],
        (err2, existing) => {

          if (err2) {
            console.error(err2);
            return res.status(500).send("Database error");
          }

          if (existing.length > 0)
            return res.status(400).send("Slot already booked");

          const verificationCode =
            Math.floor(100000 + Math.random() * 900000).toString();

          const qrToken = uuidv4();

          db.query(
            `INSERT INTO appointments
             (doctor_id, customer_id, appointment_date, slot_time, duration, amount, verification_code, qr_token, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'BOOKED')`,
            [
              doctorId,
              customerId,
              date,
              slotTime,
              duration,
              amount,
              verificationCode,
              qrToken
            ],
            (err3, result) => {

              if (err3) {
                console.error(err3);
                return res.status(500).send("Booking failed");
              }

              res.json({
                message: "Appointment booked successfully",
                bookingId: result.insertId,
                verificationCode,
                qrToken,
                status: "BOOKED"
              });
            }
          );
        }
      );
    }
  );
});

/* ================= GET CUSTOMER BOOKINGS ================= */
router.get("/appointments/my", (req, res) => {

  if (!req.session.user || req.session.user.role !== "customer")
    return res.status(401).send("Unauthorized");

  db.query(
    `SELECT a.*, 
            d.full_name as doctor_name,
            d.specialization
     FROM appointments a
     JOIN doctors d ON a.doctor_id = d.id
     WHERE a.customer_id=? 
     ORDER BY a.created_at DESC`,
    [req.session.user.id],
    (err, rows) => {

      if (err) {
        console.error(err);
        return res.status(500).send("Error fetching appointments");
      }

      res.json(rows);
    }
  );
});


/* ================= GET SINGLE APPOINTMENT (FOR LETTER) ================= */

router.get("/appointment/:id", (req, res) => {

  if (!req.session.user)
    return res.status(401).send("Unauthorized");

  db.query(
    `SELECT 
        a.id,
        a.appointment_date,
        a.slot_time,
        a.duration,
        a.amount,
        a.verification_code,
        a.qr_token,
        a.status,

        c.full_name as customer_name,
        c.email,
        c.phone,
        c.gender,

        d.full_name as doctor_name,
        d.specialization,
        d.hospital_name,
        d.hospital_address

     FROM appointments a
     JOIN customers c ON a.customer_id = c.id
     JOIN doctors d ON a.doctor_id = d.id
     WHERE a.id=?`,
    [req.params.id],
    (err, rows) => {

      if (err) {
        console.error(err);
        return res.status(500).send("Error fetching appointment");
      }

      if (!rows.length)
        return res.status(404).send("Appointment not found");

      res.json(rows[0]);
    }
  );
});

/* =====================================================
   DOCTOR DASHBOARD
   GET /doctor/dashboard?date=YYYY-MM-DD
===================================================== */

router.get("/doctor/dashboard", (req, res) => {

  if (!req.session.user || req.session.user.role !== "doctor")
    return res.status(401).json({ error: "Unauthorized" });

  const doctorId = req.session.user.id;
  const date = req.query.date;

  if (!date)
    return res.status(400).json({ error: "Date is required" });

  /* ================= GET SCHEDULE ================= */

  db.query(
    `SELECT available_slots
     FROM doctor_schedules
     WHERE doctor_id = ?
     AND DATE(schedule_date) = ?`,
    [doctorId, date],
    (scheduleErr, scheduleRows) => {

      if (scheduleErr) {
        console.error("Schedule Error:", scheduleErr);
        return res.status(500).json({ error: "Schedule fetch failed" });
      }

      if (!scheduleRows.length) {
        return res.json({
          booked: [],
          available: [],
          remaining: 0
        });
      }

      let allSlots = [];

      try {
        const rawSlots = scheduleRows[0].available_slots;

        if (rawSlots) {
          if (typeof rawSlots === "string") {
            allSlots = JSON.parse(rawSlots);
          } else {
            allSlots = rawSlots;
          }
        }
      } catch (e) {
        console.error("Slot Parse Error:", e);
        allSlots = [];
      }

      /* ================= GET BOOKED ================= */

      db.query(
        `SELECT 
            a.id,
            a.slot_time,
            a.amount,
            a.status,
            DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
            a.verification_code,
            c.full_name AS patient_name,
            c.email AS patient_email,
            c.phone AS patient_phone
         FROM appointments a
         JOIN customers c ON a.customer_id = c.id
         WHERE a.doctor_id = ?
         AND DATE(a.appointment_date) = ?
         AND a.status = 'BOOKED'
         ORDER BY a.slot_time ASC`,
        [doctorId, date],
        (appointmentErr, appointments) => {

          if (appointmentErr) {
            console.error("Appointment Error:", appointmentErr);
            return res.status(500).json({ error: "Appointments fetch failed" });
          }

          const bookedSlots = appointments.map(a => a.slot_time);

          const availableSlots = allSlots.filter(
            slot => !bookedSlots.includes(slot)
          );

          res.json({
            booked: appointments,
            available: availableSlots,
            remaining: availableSlots.length
          });
        }
      );
    }
  );
});

module.exports = router;