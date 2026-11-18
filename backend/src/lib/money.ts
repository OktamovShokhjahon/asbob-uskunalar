/** Jami = kunlar soni × kunlik narx. Integer so'm only. */
export function calcTotal(days: number, pricePerDay: number): number {
  if (!Number.isInteger(days) || !Number.isInteger(pricePerDay)) {
    throw new TypeError("calcTotal expects integers");
  }
  return days * pricePerDay;
}
