const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "pranamithra-db1.cl0iis0c412f.ap-south-1.rds.amazonaws.com",
  user: "admin",
  password: "2300030831",
  database: "pranamithra"
});

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
  } else {
    console.log("✅ Connected to RDS MySQL");
  }
});

module.exports = db;

