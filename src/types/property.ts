
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
  lower_bound_price?: number | null;
  upper_bound_price?: number | null;
  confidence_level?: 'High' | 'Medium' | 'Low';
  data_age_days?: number | null;
}

export interface PriceConfidenceData {
  lower_estimate: number;
  median_estimate: number;
  upper_estimate: number;
  confidence_level: 'High' | 'Medium' | 'Low';
  sample_size: number;
  data_age_days: number;
}
