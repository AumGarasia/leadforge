// AFTER — repository layer. Only concern: get data in/out with
// parameterized queries. No discount math, no rules, lives here.
import { Pool } from "mysql2/promise";

export interface Coupon {
  id: number; code: string; active: boolean; type: "percent" | "flat";
  value: number; minOrderValue: number;
}
export interface Order { id: number; total: number; }

export class CouponRepository {
  constructor(private pool: Pool) {}

  async findActiveByCode(code: string): Promise<Coupon | null> {
    const [rows] = await this.pool.query(
      "SELECT * FROM coupons WHERE code = ? AND active = 1", [code]
    );
    const list = rows as Coupon[];
    return list[0] ?? null;
  }

  async countRecentRedemptions(userId: number, couponId: number): Promise<number> {
    const [rows] = await this.pool.query(
      `SELECT COUNT(*) as c FROM coupon_redemptions
       WHERE userId = ? AND couponId = ? AND redeemedAt > DATE_SUB(NOW(), INTERVAL 1 MONTH)`,
      [userId, couponId]
    );
    return (rows as any)[0].c as number;
  }

  async recordRedemption(userId: number, couponId: number): Promise<void> {
    await this.pool.query(
      "INSERT INTO coupon_redemptions (userId, couponId, redeemedAt) VALUES (?, ?, NOW())",
      [userId, couponId]
    );
  }
}

export class OrderRepository {
  constructor(private pool: Pool) {}

  async findById(id: number): Promise<Order | null> {
    const [rows] = await this.pool.query("SELECT * FROM orders WHERE id = ?", [id]);
    const list = rows as Order[];
    return list[0] ?? null;
  }

  async updateTotal(id: number, newTotal: number): Promise<void> {
    await this.pool.query("UPDATE orders SET total = ? WHERE id = ?", [newTotal, id]);
  }
}
