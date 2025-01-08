export const convertToSquareMeters = (squareFeet: number | null): number | null => {
  if (squareFeet === null) return null;
  return Number((squareFeet * 0.092903).toFixed(2));
};