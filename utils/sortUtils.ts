
import { Farm, Product } from '../types';

/**
 * Calculates the rank/priority of a product based on its name.
 * Lower number = Higher priority (appears first).
 * 
 * Rules:
 * 1. Shrink Pack 6-pack Printed
 * 2. Shrink Pack 6-pack Simple
 * 3. Other Printed
 * 4. Other Simple
 * 5. Others (Default)
 * 99. Koudi, Nochi, Dozardeh, Maye
 */
export const getProductRank = (name: string): number => {
    const n = name.trim();
    
    // Top Priority
    if (n.includes('شیرینگ') && n.includes('۶') && n.includes('پرینتی')) return 1;
    if (n.includes('شیرینک') && n.includes('۶') && n.includes('پرینتی')) return 1;
    
    if (n.includes('شیرینگ') && n.includes('۶') && n.includes('ساده')) return 2;
    if (n.includes('شیرینک') && n.includes('۶') && n.includes('ساده')) return 2;

    // Bottom Priority (End of list)
    if (n.includes('کودی')) return 100;
    if (n.includes('نوکی')) return 101;
    if (n.includes('دوزرده')) return 102;
    if (n.includes('مایع')) return 103;

    // Middle Priority
    if (n.includes('پرینتی')) return 3;
    if (n.includes('ساده')) return 4;

    return 50; // Default for anything else
};

/**
 * Comparator function for sorting Products.
 */
export const compareProducts = (a: Product | { name: string }, b: Product | { name: string }): number => {
    const rankA = getProductRank(a.name);
    const rankB = getProductRank(b.name);

    if (rankA !== rankB) {
        return rankA - rankB;
    }
    // If ranks are equal, sort alphabetically
    return a.name.localeCompare(b.name, 'fa');
};

/**
 * Comparator function for sorting Farms alphabetically.
 */
export const compareFarms = (a: Farm | { name: string }, b: Farm | { name: string }): number => {
    return a.name.localeCompare(b.name, 'fa');
};
