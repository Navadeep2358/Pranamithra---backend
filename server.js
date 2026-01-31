const express = require("express");
const session = require("express-session");
const cors = require("cors");
const authRoutes = require("./routes/auth");

const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "pranamithra_secret",
  resave: false,
  saveUninitialized: false
}));

app.use("/", authRoutes);

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
