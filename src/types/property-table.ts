
import { PropertyData } from "./property";

export interface PropertyDataResultsProps {
  data: PropertyData[] | null;
  isLoading: boolean;
  error: string | null;
}

export interface SortConfig {
  key: keyof PropertyData;
  direction: 'asc' | 'desc';
}
