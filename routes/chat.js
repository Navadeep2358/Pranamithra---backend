const express = require("express");
const router = express.Router();
const db = require("../db");
const { sendMessageToLex } = require("../services/lexService");

/*
====================================================
   CHAT ROUTE
   - Uses Lex ONLY if user is NOT logged in
   - After login → frontend handles bot
====================================================
*/

router.post("/chat", async (req, res) => {

  try {

    const { message } = req.body;

    /* =========================================
       IF USER IS LOGGED IN → STOP LEX
    ========================================= */

    if (req.session.user) {
      return res.json({
        reply: "You are already logged in.",
        stopLex: true
      });
    }

    /* =========================================
       CALL LEX (ONLY FOR GUEST)
    ========================================= */

    const lexResponse = await sendMessageToLex(
      message,
      "guest-session"
    );

    let reply = "";
    let buttons = [];

    if (lexResponse.messages) {

      lexResponse.messages.forEach(msg => {

        /* ===== Plain Text ===== */
        if (msg.contentType === "PlainText") {
          reply = msg.content;
        }

        /* ===== Card Buttons ===== */
        if (msg.contentType === "ImageResponseCard") {

          const card = msg.imageResponseCard;

          if (card?.buttons) {
            buttons = card.buttons.map(btn => ({
              label: btn.text,
              value: btn.value
            }));
          }
        }
      });
    }

    /* =========================================
       LOGIN BUTTON DETECTION
    ========================================= */

    if (message === "DOCTOR_LOGIN") {

      return res.json({
        reply: "Opening Doctor Login...",
        openAuth: {
          type: "Login",
          role: "doctor"
        }
      });
    }

    if (message === "CUSTOMER_LOGIN") {

      return res.json({
        reply: "Opening Customer Login...",
        openAuth: {
          type: "Login",
          role: "customer"
        }
      });
    }

    /* =========================================
       NORMAL LEX RESPONSE
    ========================================= */

    return res.json({
      reply,
      buttons
    });

  } catch (error) {

    console.error("Lex Chat Error:", error);

    return res.json({
      reply: "Bot-Mithra is temporarily unavailable."
    });
  }
});
router.post("/send-query", (req, res) => {

  if (!req.session.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ message: "Message required" });
  }

  db.query(
    "INSERT INTO queries (user_id, role, message) VALUES (?, ?, ?)",
    [
      req.session.user.id,
      req.session.user.role,
      message
    ],
    (err) => {
      if (err) {
        console.error("Insert Query Error:", err);
        return res.status(500).json({ message: "Server error" });
      }

      res.json({ success: true });
    }
  );

});
module.exports = router;