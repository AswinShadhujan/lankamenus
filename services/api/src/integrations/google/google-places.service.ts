import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  GoogleNearbySearchResponse,
  GooglePlaceDetailsResponse,
  GooglePlaceResult,
} from './google-places.types';

const BASE_URL = 'https://maps.googleapis.com/maps/api/place';
const NEXT_PAGE_TOKEN_DELAY_MS = 2100;
const REQUEST_DELAY_MS = 150;

@Injectable()
export class GooglePlacesService {
  private readonly logger = new Logger(GooglePlacesService.name);

  constructor(private readonly config: ConfigService) {}

  getApiKey(): string | undefined {
    const key = this.config.get<string>('GOOGLE_PLACES_API_KEY');
    return key?.trim() || undefined;
  }

  isConfigured(): boolean {
    return !!this.getApiKey();
  }

  /**
   * Nearby Search. For next_page_token, call again with pageToken after waiting ≥2s.
   */
  async nearbySearch(params: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    pageToken?: string;
  }): Promise<GoogleNearbySearchResponse> {
    const key = this.getApiKey();
    if (!key) {
      throw new Error('GOOGLE_PLACES_API_KEY is not set');
    }
    const url = new URL(`${BASE_URL}/nearbysearch/json`);
    url.searchParams.set('key', key);
    if (params.pageToken) {
      url.searchParams.set('pagetoken', params.pageToken);
    } else {
      url.searchParams.set('location', `${params.latitude},${params.longitude}`);
      url.searchParams.set('radius', String(params.radiusMeters));
      url.searchParams.set('type', 'restaurant');
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Google Places Nearby Search failed: ${res.status}`);
    }
    const data = (await res.json()) as GoogleNearbySearchResponse;
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      const err = new Error(
        data.error_message || `Google Places status: ${data.status}`,
      ) as Error & { status: string; error_message?: string };
      err.status = data.status;
      err.error_message = data.error_message;
      throw err;
    }
    return data;
  }

  /**
   * Place Details. Optional: call for richer address (e.g. city, district).
   * @param options.fields — Comma-separated Place Details field mask (default includes `user_ratings_total`).
   */
  async getPlaceDetails(
    placeId: string,
    options?: { fields?: string },
  ): Promise<GooglePlaceDetailsResponse['result'] | null> {
    const key = this.getApiKey();
    if (!key) {
      throw new Error('GOOGLE_PLACES_API_KEY is not set');
    }
    const fields =
      options?.fields ??
      'place_id,name,formatted_address,address_components,geometry,rating,types,photos,user_ratings_total';
    const url = new URL(`${BASE_URL}/details/json`);
    url.searchParams.set('key', key);
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', fields);

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Google Places Details failed: ${res.status}`);
    }
    const data = (await res.json()) as GooglePlaceDetailsResponse;
    if (data.status !== 'OK') {
      this.logger.warn(`Place details ${placeId}: ${data.status}`);
      return null;
    }
    return data.result;
  }

  /**
   * Build photo URL for server-side use only (e.g. redirect in your API).
   * Never log or send this URL to the client with the key; use a proxy/redirect endpoint instead.
   */
  getPhotoUrl(photoReference: string, maxWidth = 400): string {
    const key = this.getApiKey();
    if (!key) {
      throw new Error('GOOGLE_PLACES_API_KEY is not set');
    }
    const url = new URL(`${BASE_URL}/photo`);
    url.searchParams.set('key', key);
    url.searchParams.set('photo_reference', photoReference);
    url.searchParams.set('maxwidth', String(maxWidth));
    return url.toString();
  }

  /**
   * Wait before using next_page_token (Google requires ~2s delay).
   */
  async waitForNextPageToken(): Promise<void> {
    return new Promise((resolve) =>
      setTimeout(resolve, NEXT_PAGE_TOKEN_DELAY_MS),
    );
  }

  /**
   * Small delay between requests to avoid rate limits.
   */
  async requestDelay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  }
}
