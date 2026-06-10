import { describe, it, expect } from 'vitest';
import { calculateFarmStats } from '../statisticsStore';
import { isShrinkPack } from '../../utils/sortUtils';
import { getCorrectedInventory } from '../../utils/inventoryUtils';

describe('calculateFarmStats', () => {
  it('should include separationAmount in remaining for non-shrink-pack products', () => {
    const result = calculateFarmStats({
      previousStock: 1,
      production: 1,
      sales: 0,
      separationAmount: 1,
    });
    expect(result.remaining).toBe(3);
  });

  it('should handle the exact example: prev=1, prod=1, sep=1, sales=0 → remaining=3', () => {
    const result = calculateFarmStats({
      previousStock: 1,
      production: 1,
      sales: 0,
      separationAmount: 1,
    });
    expect(result.remaining).toBe(3);
    expect(result.remainingKg).toBe(0);
  });

  it('should handle non-zero sales with separation', () => {
    const result = calculateFarmStats({
      previousStock: 10,
      production: 5,
      sales: 3,
      separationAmount: 2,
    });
    expect(result.remaining).toBe(14); // 10 + 5 + 2 - 3 = 14
  });

  it('should default separationAmount to 0 when not provided', () => {
    const result = calculateFarmStats({
      previousStock: 1,
      production: 1,
      sales: 0,
    });
    expect(result.remaining).toBe(2); // 1 + 1 + 0 - 0 = 2
  });

  it('should preserve backward compatibility when separation is 0', () => {
    const result = calculateFarmStats({
      previousStock: 5,
      production: 3,
      sales: 2,
      separationAmount: 0,
    });
    expect(result.remaining).toBe(6); // 5 + 3 + 0 - 2 = 6
  });

  it('should handle kg values correctly', () => {
    const result = calculateFarmStats({
      previousStock: 0,
      production: 0,
      sales: 0,
      previousStockKg: 10,
      productionKg: 5,
      salesKg: 2,
    });
    expect(result.remainingKg).toBe(13); // 10 + 5 - 2 = 13
    expect(result.remaining).toBe(0);
  });
});

describe('getCorrectedInventory', () => {
  it('should include separation for non-shrink-pack products when productName is given', () => {
    const result = getCorrectedInventory({
      previousBalance: 1,
      production: 1,
      separationAmount: 1,
      sales: 0,
    }, 'کودی');
    expect(result.units).toBe(3);
  });

  it('should exclude separation for shrink pack products', () => {
    const result = getCorrectedInventory({
      previousBalance: 1,
      production: 1,
      separationAmount: 1,
      sales: 0,
    }, 'شیرینگ پک ۶ شانه ساده');
    expect(result.units).toBe(2); // separation excluded for shrink pack
  });

  it('should include separation when no productName is provided', () => {
    const result = getCorrectedInventory({
      previousBalance: 1,
      production: 1,
      separationAmount: 1,
      sales: 0,
    });
    expect(result.units).toBe(3);
  });

  it('should handle kg correctly', () => {
    const result = getCorrectedInventory({
      previousBalance: 0,
      production: 0,
      sales: 0,
      previousBalanceKg: 10,
      productionKg: 5,
      salesKg: 2,
    });
    expect(result.kg).toBe(13);
    expect(result.units).toBe(0);
  });
});

describe('isShrinkPack', () => {
  it('should identify 6-pack printed shrink pack', () => {
    expect(isShrinkPack('شیرینگ پک ۶ شانه پرینتی')).toBe(true);
    expect(isShrinkPack('شیرینک پک ۶ شانه پرینتی')).toBe(true);
  });

  it('should identify 6-pack simple shrink pack', () => {
    expect(isShrinkPack('شیرینگ پک ۶ شانه ساده')).toBe(true);
    expect(isShrinkPack('شیرینک پک ۶ شانه ساده')).toBe(true);
  });

  it('should NOT identify non-shrink-pack products', () => {
    expect(isShrinkPack('کودی')).toBe(false);
    expect(isShrinkPack('نوکی')).toBe(false);
    expect(isShrinkPack('دوزرده')).toBe(false);
    expect(isShrinkPack('مایع')).toBe(false);
    expect(isShrinkPack('پرینتی معمولی')).toBe(false);
  });
});
