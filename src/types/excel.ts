export interface PreviewData {
  address: string;
  postcode: string;
  isValid: boolean;
  error?: string;
}

export interface ProcessedData {
  address: string;
  postcode: string;
  floor_area_sq_ft: number | null;
  floor_area_sq_m: number | null;
  habitable_rooms: number;
  inspection_date: string;
}