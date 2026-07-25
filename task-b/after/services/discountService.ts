// AFTER — service layer. Every rule that used to be buried in the route
// handler now lives here as plain, synchronous, unit-testable logic. This
// class takes repositories as constructor args, so tests can inject fakes
// instead of hitting a real database.
import { CouponRepository, OrderRepository } from "../repositories/discountRepositories";

export class DiscountError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export class DiscountService {
  constructor(
    private coupons: CouponRepository,
    private orders: OrderRepository
  ) {}

  async applyCoupon(input: { orderId: number; couponCode: string; userId: number }) {
    const coupon = await this.coupons.findActiveByCode(input.couponCode);
    if (!coupon) throw new DiscountError("INVALID_COUPON", "Coupon is invalid or inactive.");

    const order = await this.orders.findById(input.orderId);
    if (!order) throw new DiscountError("ORDER_NOT_FOUND", "Order does not exist.");

    if (order.total < coupon.minOrderValue) {
      throw new DiscountError("MIN_ORDER_NOT_MET", "Order does not meet the coupon's minimum value.");
    }

    const recentRedemptions = await this.coupons.countRecentRedemptions(input.userId, coupon.id);
    if (recentRedemptions > 0) {
      throw new DiscountError("ALREADY_REDEEMED", "This coupon was already used this month.");
    }

    const newTotal = this.calculateDiscountedTotal(order.total, coupon);

    await this.orders.updateTotal(order.id, newTotal);
    await this.coupons.recordRedemption(input.userId, coupon.id);

    return { newTotal };
  }

  // Pulled out as its own pure function — this is the piece that most
  // benefits from being outside the route handler: zero I/O, trivial to
  // exhaustively unit test (percent vs flat, discount larger than total, etc).
  calculateDiscountedTotal(orderTotal: number, coupon: { type: "percent" | "flat"; value: number }): number {
    const discount = coupon.type === "percent" ? orderTotal * (coupon.value / 100) : coupon.value;
    return Math.max(0, orderTotal - discount);
  }
}
