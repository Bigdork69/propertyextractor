export interface PropertyData {
  address: string;
  floor_area_sq_ft: number | null;
  floor_area_sq_m: number | null;
  habitable_rooms: number;
  inspection_date: string;
  price_per_sq_ft?: number | null;
  price_per_sq_m?: number | null;
  estimated_value?: number | null;
  pricing_date?: string | null;
  transaction_count?: number | null;
}