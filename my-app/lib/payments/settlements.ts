import type { QueryResultRow } from "pg";
import { query } from "@/lib/db";
import { getOmiseConfigurationState } from "@/lib/payments/omise";

export type SettlementSummary = {
  paymentId: string;
  rentalRequestId: string;
  lender: { id: string; displayName: string; email: string };
  amount: string;
  currency: string;
  status: string;
  payoutMode: string;
  provider: string;
  recipientProviderReference: string | null;
  providerTransferReference: string | null;
  reason: string | null;
  livePayoutsEnabled: boolean;
  createdAt: string;
};

type SettlementRow = QueryResultRow & {
  payment_id: string;
  rental_request_id: string;
  lender_id: string;
  lender_display_name: string;
  lender_email: string;
  amount: string;
  currency: string;
  metadata: Record<string, unknown>;
  created_at: Date;
};

function settlementObject(metadata: Record<string, unknown>): Record<string, unknown> {
  const value = metadata?.settlement;
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export async function listPlatformSettlements(): Promise<SettlementSummary[]> {
  const result = await query<SettlementRow>(
    `SELECT p.id AS payment_id, p.rental_request_id, r.lender_id,
            lender.display_name AS lender_display_name, lender.email AS lender_email,
            p.amount, p.currency, p.metadata, p.created_at
     FROM payments p
     JOIN rental_requests r ON r.id = p.rental_request_id
     JOIN users lender ON lender.id = r.lender_id
     WHERE p.type = 'RENTAL'
       AND p.status = 'SUCCEEDED'
       AND p.metadata ? 'settlement'
     ORDER BY p.created_at DESC
     LIMIT 200`,
  );
  const omise = getOmiseConfigurationState();
  return result.rows.map((row) => {
    const settlement = settlementObject(row.metadata);
    return {
      paymentId: row.payment_id,
      rentalRequestId: row.rental_request_id,
      lender: { id: row.lender_id, displayName: row.lender_display_name, email: row.lender_email },
      amount: typeof settlement.payoutAmount === "string" ? settlement.payoutAmount : row.amount,
      currency: typeof settlement.currency === "string" ? settlement.currency : row.currency,
      status: typeof settlement.status === "string" ? settlement.status : "PLATFORM_HELD",
      payoutMode: typeof settlement.payoutMode === "string" ? settlement.payoutMode : "MANUAL_REQUIRED",
      provider: typeof settlement.payoutProvider === "string" ? settlement.payoutProvider : "OMISE_TRANSFER",
      recipientProviderReference: typeof settlement.recipientProviderReference === "string" ? settlement.recipientProviderReference : null,
      providerTransferReference: typeof settlement.providerTransferReference === "string" ? settlement.providerTransferReference : null,
      reason: typeof settlement.reason === "string" ? settlement.reason : null,
      livePayoutsEnabled: Boolean(omise.config?.livePayoutsEnabled),
      createdAt: row.created_at.toISOString(),
    };
  });
}
