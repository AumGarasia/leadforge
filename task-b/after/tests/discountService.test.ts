// Proof of the refactor's payoff: this test exercises real business logic
// with zero HTTP server and zero real database — impossible against the
// BEFORE version, where the same logic only runs inside a live route
// handler wired to a real MySQL connection.
import { DiscountService, DiscountError } from "../services/discountService";

function fakeRepos(overrides: Partial<{ coupon: any; order: any; redemptions: number }> = {}) {
  const coupon = overrides.coupon ?? { id: 1, code: "SAVE10", active: true, type: "percent", value: 10, minOrderValue: 0 };
  const order = overrides.order ?? { id: 1, total: 100 };
  const redemptions = overrides.redemptions ?? 0;

  const coupons = {
    findActiveByCode: async () => coupon,
    countRecentRedemptions: async () => redemptions,
    recordRedemption: async () => {},
  } as any;
  const orders = {
    findById: async () => order,
    updateTotal: async () => {},
  } as any;

  return { coupons, orders };
}

describe("DiscountService (unit — no DB, no HTTP)", () => {
  it("applies a percent discount correctly", async () => {
    const { coupons, orders } = fakeRepos();
    const service = new DiscountService(coupons, orders);
    const result = await service.applyCoupon({ orderId: 1, couponCode: "SAVE10", userId: 1 });
    expect(result.newTotal).toBe(90);
  });

  it("applies a flat discount and never goes below zero", async () => {
    const { coupons, orders } = fakeRepos({
      coupon: { id: 1, code: "FLAT50", active: true, type: "flat", value: 500, minOrderValue: 0 },
      order: { id: 1, total: 20 },
    });
    const service = new DiscountService(coupons, orders);
    const result = await service.applyCoupon({ orderId: 1, couponCode: "FLAT50", userId: 1 });
    expect(result.newTotal).toBe(0);
  });

  it("rejects a coupon already redeemed this month", async () => {
    const { coupons, orders } = fakeRepos({ redemptions: 1 });
    const service = new DiscountService(coupons, orders);
    await expect(service.applyCoupon({ orderId: 1, couponCode: "SAVE10", userId: 1 }))
      .rejects.toThrow(DiscountError);
  });

  it("rejects an order below the coupon's minimum value", async () => {
    const { coupons, orders } = fakeRepos({
      coupon: { id: 1, code: "SAVE10", active: true, type: "percent", value: 10, minOrderValue: 200 },
      order: { id: 1, total: 100 },
    });
    const service = new DiscountService(coupons, orders);
    await expect(service.applyCoupon({ orderId: 1, couponCode: "SAVE10", userId: 1 }))
      .rejects.toThrow(DiscountError);
  });
});
