'use client';

import { useState } from 'react';
import { District } from '@/types/restaurant';
import { FoodCategoryMultiSelect } from '@/components/admin/FoodCategoryMultiSelect';
import { normalizeRestaurantCategories } from '@/lib/foodCategories';

export type RestaurantFormValues = {
  name_default: string;
  city: string;
  district: string;
  address_line1: string;
  /** UI: selected food categories → API `cuisine_tags`. */
  category_tags: string[];
  price_level: number | '';
  veg_friendly: boolean;
  halal_certified: boolean;
  lat: string;
  lng: string;
};

const defaultValues: RestaurantFormValues = {
  name_default: '',
  city: '',
  district: '',
  address_line1: '',
  category_tags: [],
  price_level: '',
  veg_friendly: false,
  halal_certified: false,
  lat: '',
  lng: '',
};

type Props = {
  districts: District[];
  initialValues?: Partial<RestaurantFormValues>;
  onSubmit: (values: RestaurantFormValues) => void;
  loading?: boolean;
  submitLabel?: string;
};

export function restaurantFormToBody(values: RestaurantFormValues) {
  const body: Record<string, unknown> = {
    name_default: values.name_default.trim(),
    city: values.city.trim() || undefined,
    district: values.district || undefined,
    address_line1: values.address_line1.trim() || undefined,
    cuisine_tags: normalizeRestaurantCategories(values.category_tags),
    price_level: values.price_level === '' ? undefined : Number(values.price_level),
    veg_friendly: values.veg_friendly,
    halal_certified: values.halal_certified,
  };
  const lat = values.lat.trim() ? parseFloat(values.lat) : NaN;
  const lng = values.lng.trim() ? parseFloat(values.lng) : NaN;
  if (!Number.isNaN(lat)) body.lat = lat;
  if (!Number.isNaN(lng)) body.lng = lng;
  return body;
}

export function restaurantToFormValues(r: {
  name_default: string;
  city?: string | null;
  district?: string | null;
  address_line1?: string | null;
  cuisine_tags: string[];
  price_level?: number | null;
  veg_friendly?: boolean | null;
  halal_certified?: boolean | null;
}): RestaurantFormValues {
  return {
    name_default: r.name_default ?? '',
    city: r.city ?? '',
    district: r.district ?? '',
    address_line1: r.address_line1 ?? '',
    category_tags: normalizeRestaurantCategories(r.cuisine_tags),
    price_level: r.price_level ?? '',
    veg_friendly: r.veg_friendly ?? false,
    halal_certified: r.halal_certified ?? false,
    lat: '',
    lng: '',
  };
}

export default function RestaurantForm({
  districts,
  initialValues,
  onSubmit,
  loading = false,
  submitLabel = 'Save',
}: Props) {
  const values = { ...defaultValues, ...initialValues };

  const [name_default, setNameDefault] = useState(values.name_default);
  const [city, setCity] = useState(values.city);
  const [district, setDistrict] = useState(values.district);
  const [address_line1, setAddressLine1] = useState(values.address_line1);
  const [category_tags, setCategoryTags] = useState<string[]>(values.category_tags);
  const [price_level, setPriceLevel] = useState<number | ''>(values.price_level);
  const [veg_friendly, setVegFriendly] = useState(values.veg_friendly);
  const [halal_certified, setHalalCertified] = useState(values.halal_certified);
  const [lat, setLat] = useState(values.lat);
  const [lng, setLng] = useState(values.lng);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name_default,
      city,
      district,
      address_line1,
      category_tags,
      price_level,
      veg_friendly,
      halal_certified,
      lat,
      lng,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      <div>
        <label htmlFor="name_default" className="admin-label">
          Name *
        </label>
        <input
          id="name_default"
          type="text"
          value={name_default}
          onChange={(e) => setNameDefault(e.target.value)}
          required
          className="admin-input"
        />
      </div>
      <div>
        <label htmlFor="district" className="admin-label">
          District
        </label>
        <select
          id="district"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className="admin-select"
        >
          <option value="">—</option>
          {districts.map((d) => (
            <option key={d.id} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="city" className="admin-label">
          City
        </label>
        <input
          id="city"
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="admin-input"
        />
      </div>
      <div>
        <label htmlFor="address_line1" className="admin-label">
          Address
        </label>
        <input
          id="address_line1"
          type="text"
          value={address_line1}
          onChange={(e) => setAddressLine1(e.target.value)}
          className="admin-input"
        />
      </div>
      <div>
        <span className="admin-label mb-2 block">Categories</span>
        <FoodCategoryMultiSelect
          selected={category_tags}
          onChange={setCategoryTags}
          disabled={loading}
        />
      </div>
      <div>
        <label htmlFor="price_level" className="admin-label">
          Price level (1–4)
        </label>
        <select
          id="price_level"
          value={price_level === '' ? '' : String(price_level)}
          onChange={(e) => setPriceLevel(e.target.value === '' ? '' : Number(e.target.value))}
          className="admin-select"
        >
          <option value="">—</option>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-8">
        <label className="admin-checkbox-label">
          <input type="checkbox" checked={veg_friendly} onChange={(e) => setVegFriendly(e.target.checked)} />
          Veg friendly
        </label>
        <label className="admin-checkbox-label">
          <input type="checkbox" checked={halal_certified} onChange={(e) => setHalalCertified(e.target.checked)} />
          Halal certified
        </label>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lat" className="admin-label">
            Latitude (optional)
          </label>
          <input
            id="lat"
            type="text"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="e.g. 6.9271"
            className="admin-input"
          />
        </div>
        <div>
          <label htmlFor="lng" className="admin-label">
            Longitude (optional)
          </label>
          <input
            id="lng"
            type="text"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="e.g. 79.8612"
            className="admin-input"
          />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="admin-btn-primary">
          {loading ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
