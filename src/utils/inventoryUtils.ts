
import { isShrinkPack } from './sortUtils';

export interface InvoiceItem {
    id?: string;
    product_id: string; // The product BEING SOLD (e.g., Simple)
    total_cartons: number;
    total_weight: number;
    source_product_id?: string | null; // The product it was CONVERTED FROM (e.g., Printable)
    converted_amount?: number | null;
    is_converted?: boolean | null;
}

/**
 * Computes the CORRECTED remaining inventory on-the-fly.
 * 
 * For non-shrink-pack products: remaining = previousBalance + production + separationAmount - sales
 * For shrink pack products: remaining = previousBalance + production - sales (separation excluded)
 * 
 * This should be used for ALL display purposes instead of the stored currentInventory,
 * because old records in the database may have currentInventory computed without separation.
 */
export const getCorrectedInventory = (stat: {
    previousBalance?: number;
    production?: number;
    sales?: number;
    separationAmount?: number;
    currentInventory?: number;
    currentInventoryKg?: number;
    previousBalanceKg?: number;
    productionKg?: number;
    salesKg?: number;
}, productName?: string): { units: number; kg: number } => {
    const prev = stat.previousBalance || 0;
    const prod = stat.production || 0;
    const sales = stat.sales || 0;
    const prevKg = stat.previousBalanceKg || 0;
    const prodKg = stat.productionKg || 0;
    const salesKg = stat.salesKg || 0;

    // Determine if this is a shrink pack (separation excluded)
    let sep = stat.separationAmount || 0;
    if (productName && isShrinkPack(productName)) {
        sep = 0;
    }

    return {
        units: prev + prod + sep - sales,
        kg: prevKg + prodKg - salesKg
    };
};

/**
 * Calculates how much of a specific product was "used" or "deducted" from inventory
 * based on a list of invoices.
 * 
 * Logic:
 * 1. Direct Sales: Invoice product == targetProductId.
 *    Deduction = Total - ConvertedFromOthers.
 *    (If I sold 100 Simple, but 20 came from Printable, I only used 80 Simple from stock).
 * 
 * 2. Source Conversion: Invoice source_product == targetProductId.
 *    Deduction = ConvertedAmount.
 *    (If I sold 100 Simple, and 20 came from Printable, I used 20 Printable from stock).
 */
export const calculateProductUsage = (invoices: InvoiceItem[], targetProductId: string) => {
    let usageCartons = 0;
    let usageWeight = 0;

    for (const inv of invoices) {
        // Case A: Direct Sale of this product
        if (inv.product_id === targetProductId) {
            const total = inv.total_cartons || 0;
            const weight = inv.total_weight || 0;
            const converted = inv.converted_amount || 0;

            // Usage = Total - (Amount that came from elsewhere)
            const myUsage = Math.max(0, total - converted);
            usageCartons += myUsage;

            // Proportional weight
            const myWeight = total > 0 ? (myUsage / total) * weight : 0;
            usageWeight += myWeight;
        }

        // Case B: This product was the SOURCE for another product
        if (inv.source_product_id === targetProductId && inv.is_converted) {
            const converted = inv.converted_amount || 0;
            const total = inv.total_cartons || 0;
            const weight = inv.total_weight || 0;

            // Usage = The amount I gave
            usageCartons += converted;

            // Proportional weight estimation
            const myWeight = total > 0 ? (converted / total) * weight : 0;
            usageWeight += myWeight;
        }
    }

    return { usageCartons, usageWeight };
};
