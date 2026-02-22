const mysql = require("mysql2");

let db;

if (process.env.DATABASE_URL) {
  // Production (Railway)
  db = mysql.createConnection(process.env.DATABASE_URL);
} else {
  // Local (for development)
  db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "1234",
    database: "pranamithra"
  });
}

db.connect(err => {
  if (err) {
    console.log("DB Connection Error:", err);
  } else {
    console.log("MySQL Connected ✅");
  }
});

module.exports = db;