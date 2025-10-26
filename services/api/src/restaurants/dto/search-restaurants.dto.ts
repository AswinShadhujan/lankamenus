export class SearchRestaurantsDto {
  q?: string;                // text search
  city?: string;
  district?: string;
  cuisine?: string | string[]; // e.g., "Sri Lankan" or ["Sri Lankan","Indian"]
  veg?: string;               // "true"/"false"
  halal?: string;             // "true"/"false"
  pricelevel?: string | string[];
  page?: string;              // pagination
  pagesize?: string;          // pagination
  sort?: 'relevance' | 'rating' | 'price' | 'distance';
}
