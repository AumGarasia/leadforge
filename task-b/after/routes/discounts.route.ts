// AFTER — the route handler's only job now is: parse request, call the
// service, map the result/error to an HTTP response. Compare to the
// ~70-line nested-callback pyramid in before/discounts.route.js.
import { Router } from "express";
import { DiscountService, DiscountError } from "../services/discountService";

export function discountsRouter(service: DiscountService) {
  const router = Router();

  router.post("/discounts/apply", async (req, res) => {
    try {
      const { orderId, couponCode, userId } = req.body;
      const result = await service.applyCoupon({ orderId, couponCode, userId });
      res.json({ data: result });
    } catch (err) {
      if (err instanceof DiscountError) {
        return res.status(400).json({ error: { code: err.code, message: err.message } });
      }
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong." } });
    }
  });

  return router;
}
