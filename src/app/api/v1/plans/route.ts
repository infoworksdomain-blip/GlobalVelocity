import { NextResponse } from "next/server";
import { PLANS, CREDIT_TARIFF, CREDIT_PACKS, YEARLY_DISCOUNT, yearlyPricePerMonth } from "@/lib/plans";
export const GET = async () => NextResponse.json({ plans: Object.values(PLANS).map((p) => ({ ...p, priceYearPerMonth: yearlyPricePerMonth(p) })), credit_tariff: CREDIT_TARIFF, credit_packs: CREDIT_PACKS, yearly_discount: YEARLY_DISCOUNT });
