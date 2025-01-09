import { Search } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

interface SearchFormProps {
  address: string;
  onAddressChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}

const SearchForm = ({ address, onAddressChange, onSubmit, isLoading }: SearchFormProps) => {
  return (
    <form onSubmit={onSubmit} className="relative w-full">
      <div className="relative w-full bg-white/95 rounded-full overflow-hidden flex shadow-lg">
        <Input
          type="text"
          placeholder="Enter a postcode (e.g., W14 9JH) or exact address with postcode"
          className="pl-12 pr-6 py-6 w-full border-none text-lg"
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          disabled={isLoading}
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-estate-400 w-5 h-5" />
        <Button 
          type="submit" 
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-6"
          disabled={isLoading}
        >
          {isLoading ? "Searching..." : "Search"}
        </Button>
      </div>
    </form>
  );
};

export default SearchForm;