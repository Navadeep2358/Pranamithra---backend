const mysql = require("mysql2");
require("dotenv").config();

let db;

if (process.env.DATABASE_URL) {
  // Production (Railway)
  db = mysql.createConnection(process.env.DATABASE_URL);
} else {
  // Local Development
  db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "2358",
    database: "pranamithra"
  });
}

db.connect((err) => {
  if (err) {
    console.error("DB Connection Error:", err);
  } else {
    console.log("MySQL Connected ✅");
  }
});

module.exports = db;