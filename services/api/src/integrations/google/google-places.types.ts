/**
 * Types for Google Places API responses (subset we use).
 */

export interface GooglePlaceGeometry {
  location: { lat: number; lng: number };
}

export interface GooglePlacePhoto {
  photo_reference: string;
  width?: number;
  height?: number;
}

export interface GooglePlaceResult {
  place_id: string;
  name?: string;
  vicinity?: string;
  geometry?: GooglePlaceGeometry;
  rating?: number;
  /** Google review count (Nearby Search). */
  user_ratings_total?: number;
  types?: string[];
  photos?: GooglePlacePhoto[];
}

export interface GoogleNearbySearchResponse {
  results: GooglePlaceResult[];
  next_page_token?: string;
  status: string;
  error_message?: string;
}

export interface GooglePlaceDetailsAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

export interface GooglePlaceDetailsResult {
  place_id: string;
  name?: string;
  formatted_address?: string;
  address_components?: GooglePlaceDetailsAddressComponent[];
  geometry?: GooglePlaceGeometry;
  rating?: number;
  /** Google review count (Place Details). */
  user_ratings_total?: number;
  types?: string[];
  photos?: GooglePlacePhoto[];
}

export interface GooglePlaceDetailsResponse {
  result: GooglePlaceDetailsResult;
  status: string;
  error_message?: string;
}
