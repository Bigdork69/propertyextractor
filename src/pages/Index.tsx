import SearchBar from "@/components/SearchBar";
import ExcelProcessor from "@/components/ExcelProcessor";

const Index = () => {
  return (
    <div className="min-h-screen bg-estate-100 py-12">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-display text-estate-800 text-center mb-8">
          Property Floor Area Search
        </h1>
        <SearchBar />
        <ExcelProcessor />
      </div>
    </div>
  );
};

export default Index;