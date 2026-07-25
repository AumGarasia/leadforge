// BEFORE — reproduces the anti-patterns described in the Task B brief:
// business logic inside the route handler, a raw DB call built with string
// concatenation, and a hardcoded secret. This is deliberately written to be
// realistic, not a strawman — this is the shape legacy Express apps
// genuinely end up in after a few years of "just add it to the route."

const express = require("express");
const mysql = require("mysql2");
const jwt = require("jsonwebtoken");
const router = express.Router();

const db = mysql.createConnection({
  host: "prod-db.internal",
  user: "app_user",
  password: "Sup3rSecret!2019", // hardcoded secret — CRITICAL risk, see assessment
});

router.post("/discounts/apply", (req, res) => {
  const { orderId, couponCode, userId } = req.body;

  // Business logic (discount eligibility rules) living directly in the
  // route handler — untestable without spinning up the whole HTTP stack.
  db.query(
    // String-concatenated SQL — SQL injection risk (couponCode is
    // attacker-controlled), plus no schema/type safety at all.
    "SELECT * FROM coupons WHERE code = '" + couponCode + "' AND active = 1",
    (err, coupons) => {
      if (err) return res.status(500).send("DB error");
      if (coupons.length === 0) return res.status(400).send("Invalid coupon");

      const coupon = coupons[0];

      db.query("SELECT * FROM orders WHERE id = " + orderId, (err2, orders) => {
        if (err2) return res.status(500).send("DB error");
        const order = orders[0];

        // More business rules, still inline: minimum order value,
        // one-coupon-per-user-per-month, percentage vs flat discount math.
        if (order.total < coupon.minOrderValue) {
          return res.status(400).send("Order does not meet minimum for this coupon");
        }

        db.query(
          "SELECT COUNT(*) as c FROM coupon_redemptions WHERE userId = " +
            userId +
            " AND couponId = " +
            coupon.id +
            " AND redeemedAt > DATE_SUB(NOW(), INTERVAL 1 MONTH)",
          (err3, rows) => {
            if (err3) return res.status(500).send("DB error");
            if (rows[0].c > 0) return res.status(400).send("Coupon already used this month");

            const discount =
              coupon.type === "percent" ? order.total * (coupon.value / 100) : coupon.value;
            const newTotal = Math.max(0, order.total - discount);

            db.query(
              "UPDATE orders SET total = " + newTotal + " WHERE id = " + orderId,
              (err4) => {
                if (err4) return res.status(500).send("DB error");
                db.query(
                  "INSERT INTO coupon_redemptions (userId, couponId, redeemedAt) VALUES (" +
                    userId +
                    ", " +
                    coupon.id +
                    ", NOW())",
                  (err5) => {
                    if (err5) return res.status(500).send("DB error");
                    res.json({ newTotal });
                  }
                );
              }
            );
          }
        );
      });
    }
  );
});

module.exports = router;
