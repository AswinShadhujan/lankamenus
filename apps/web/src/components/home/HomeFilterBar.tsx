'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { District } from '@/types/restaurant';
import type { UserLocationState } from '@/lib/homeUserLocation';
import { HOME_DISH_CATEGORIES } from '@/constants/homeDishCategories';
import { HomeCategoryStrip } from '@/components/home/HomeCategoryStrip';
import { FilterCenterModal } from '@/components/home/FilterCenterModal';

export type HomeSortMode = 'default' | 'popular' | 'top_rated' | 'trending' | 'distance';

type RestaurantSortChoice = 'none' | 'popular' | 'top_rated' | 'trending' | 'rating45';

function filterBtnStyle(active: boolean): CSSProperties {
  return active
    ? {
        backgroundColor: 'color-mix(in srgb, var(--accent-primary) 10%, var(--surface))',
        color: 'var(--accent-primary)',
        borderColor: 'color-mix(in srgb, var(--accent-primary) 45%, var(--border))',
      }
    : {
        backgroundColor: 'transparent',
        borderColor: 'var(--border)',
        color: 'var(--text-secondary)',
      };
}

const FILTER_BTN_CLASS =
  'shrink-0 rounded-full border border-solid px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)] sm:text-sm';

const FILTER_ROW_CLASS =
  'hide-scrollbar mb-3 flex flex-nowrap items-center gap-2 overflow-x-auto sm:mb-4 [-webkit-overflow-scrolling:touch]';

function sortToChoice(sort: HomeSortMode, filterHighRating: boolean): RestaurantSortChoice {
  if (filterHighRating) return 'rating45';
  if (sort === 'popular') return 'popular';
  if (sort === 'top_rated') return 'top_rated';
  if (sort === 'trending') return 'trending';
  return 'none';
}

function choiceToSort(choice: RestaurantSortChoice): {
  sort: HomeSortMode;
  filterHighRating: boolean;
} {
  if (choice === 'popular') return { sort: 'popular', filterHighRating: false };
  if (choice === 'top_rated') return { sort: 'top_rated', filterHighRating: false };
  if (choice === 'trending') return { sort: 'trending', filterHighRating: false };
  if (choice === 'rating45') return { sort: 'default', filterHighRating: true };
  return { sort: 'default', filterHighRating: false };
}

export function restaurantFilterLabel(
  sort: HomeSortMode,
  filterHighRating: boolean,
  categories: string[],
): string | null {
  if (sort === 'popular') return 'Popular';
  if (sort === 'top_rated') return 'Top Rated';
  if (sort === 'trending') return 'Trending';
  if (filterHighRating) return '4.5+';
  if (categories.length === 1) return categories[0];
  if (categories.length > 1) return `${categories.length} cuisines`;
  return null;
}

export type NearMeScope = 'dish' | 'restaurant';

export type HomeFilterBarProps = {
  nearMeGeoEnabled: boolean;
  onNearMeGeoChange: (enabled: boolean) => void;
  /** Separate near-me for restaurant section; falls back to `nearMeGeoEnabled` when omitted. */
  restaurantNearMeGeoEnabled?: boolean;
  onRestaurantNearMeGeoChange?: (enabled: boolean) => void;
  userLocation: UserLocationState;
  onRequestLocation: (scope: NearMeScope) => void;
  selectedDishCategory: string | null;
  onDishCategoryApply: (category: string | null) => void;
  selectedSort: HomeSortMode;
  filterHighRating: boolean;
  onRestaurantFiltersApply: (sort: HomeSortMode, filterHighRating: boolean, categories: string[]) => void;
  selectedCategories: string[];
  districts: District[];
  selectedDistricts: string[];
  onDistrictApply: (districts: string[]) => void;
  /** When false, hides the dish-type filter (e.g. on /restaurants). */
  showDishType?: boolean;
};

type HomeFiltersContextValue = HomeFilterBarProps & {
  showDishType: boolean;
  openDishModal: () => void;
  openRestaurantModal: () => void;
  openDistrictModal: () => void;
  isNearMeActive: (scope: NearMeScope) => boolean;
  handleNearMeClick: (scope: NearMeScope) => void;
  restaurantActiveLabel: string | null;
};

const HomeFiltersContext = createContext<HomeFiltersContextValue | null>(null);

function useHomeFilters() {
  const ctx = useContext(HomeFiltersContext);
  if (!ctx) {
    throw new Error('Home filter components must be used within HomeFiltersProvider');
  }
  return ctx;
}

export function HomeFiltersProvider({
  children,
  showDishType = true,
  ...props
}: HomeFilterBarProps & { children: ReactNode }) {
  const [dishModalOpen, setDishModalOpen] = useState(false);
  const [restaurantModalOpen, setRestaurantModalOpen] = useState(false);
  const [districtModalOpen, setDistrictModalOpen] = useState(false);

  const [draftDish, setDraftDish] = useState<string | null>(null);
  const [draftSortChoice, setDraftSortChoice] = useState<RestaurantSortChoice>('none');
  const [draftCategories, setDraftCategories] = useState<string[]>([]);
  const [draftDistrict, setDraftDistrict] = useState<string>('');
  const [districtSearch, setDistrictSearch] = useState('');

  const locationGranted = props.userLocation.status === 'granted';

  const isNearMeEnabled = useCallback(
    (scope: NearMeScope) => {
      if (scope === 'restaurant' && props.restaurantNearMeGeoEnabled !== undefined) {
        return props.restaurantNearMeGeoEnabled;
      }
      return props.nearMeGeoEnabled;
    },
    [props.nearMeGeoEnabled, props.restaurantNearMeGeoEnabled],
  );

  const isNearMeActive = useCallback(
    (scope: NearMeScope) => isNearMeEnabled(scope) && locationGranted,
    [isNearMeEnabled, locationGranted],
  );

  const openDishModal = () => {
    setDraftDish(props.selectedDishCategory);
    setDishModalOpen(true);
  };

  const openRestaurantModal = () => {
    setDraftSortChoice(sortToChoice(props.selectedSort, props.filterHighRating));
    setDraftCategories([...props.selectedCategories]);
    setRestaurantModalOpen(true);
  };

  const openDistrictModal = () => {
    setDraftDistrict(props.selectedDistricts[0] ?? '');
    setDistrictSearch('');
    setDistrictModalOpen(true);
  };

  const filteredDistricts = useMemo(() => {
    const q = districtSearch.trim().toLowerCase();
    if (!q) return props.districts;
    return props.districts.filter((d) => d.name.toLowerCase().includes(q));
  }, [props.districts, districtSearch]);

  const toggleDraftCategory = useCallback((label: string) => {
    setDraftCategories((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label],
    );
  }, []);

  const restaurantActiveLabel = restaurantFilterLabel(
    props.selectedSort,
    props.filterHighRating,
    props.selectedCategories,
  );

  const handleNearMeClick = (scope: NearMeScope) => {
    if (locationGranted) {
      const enabled = isNearMeEnabled(scope);
      if (scope === 'restaurant' && props.onRestaurantNearMeGeoChange) {
        props.onRestaurantNearMeGeoChange(!enabled);
      } else {
        props.onNearMeGeoChange(!enabled);
      }
      return;
    }
    props.onRequestLocation(scope);
  };

  const ctx: HomeFiltersContextValue = {
    ...props,
    showDishType,
    openDishModal,
    openRestaurantModal,
    openDistrictModal,
    isNearMeActive,
    handleNearMeClick,
    restaurantActiveLabel,
  };

  return (
    <HomeFiltersContext.Provider value={ctx}>
      {children}

      {showDishType ? (
        <FilterCenterModal
          wide
          open={dishModalOpen}
          title="Filter by dish type"
          onClose={() => setDishModalOpen(false)}
          onApply={() => {
            props.onDishCategoryApply(draftDish);
            setDishModalOpen(false);
          }}
          onClear={() => {
            props.onDishCategoryApply(null);
            setDishModalOpen(false);
          }}
        >
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {HOME_DISH_CATEGORIES.map(({ label, emoji }) => {
              const active = draftDish === label;
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDraftDish(active ? null : label)}
                  className="rounded-full border border-solid px-2.5 py-1.5 text-center text-xs font-medium transition-colors"
                  style={filterBtnStyle(active)}
                >
                  {emoji ? (
                    <span className="mr-1" aria-hidden>
                      {emoji}
                    </span>
                  ) : null}
                  {label}
                </button>
              );
            })}
          </div>
        </FilterCenterModal>
      ) : null}

      <FilterCenterModal
        wide
        open={restaurantModalOpen}
        title="Filter restaurants"
        onClose={() => setRestaurantModalOpen(false)}
        onApply={() => {
          const { sort, filterHighRating: rating } = choiceToSort(draftSortChoice);
          props.onRestaurantFiltersApply(sort, rating, draftCategories);
          setRestaurantModalOpen(false);
        }}
        onClear={() => {
          props.onRestaurantFiltersApply('default', false, []);
          setRestaurantModalOpen(false);
        }}
      >
        <p
          className="mb-2 text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--text-secondary)' }}
        >
          Sort by
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ['popular', 'Popular'],
              ['top_rated', 'Top Rated'],
              ['trending', 'Trending'],
              ['rating45', '⭐ 4.5+'],
            ] as const
          ).map(([value, label]) => {
            const active = draftSortChoice === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setDraftSortChoice(active ? 'none' : value)}
                className="rounded-full border border-solid px-2.5 py-1 text-xs font-medium transition-colors"
                style={filterBtnStyle(active)}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p
          className="mb-2 text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--text-secondary)' }}
        >
          Cuisine
        </p>
        <HomeCategoryStrip selected={draftCategories} onToggle={toggleDraftCategory} />
      </FilterCenterModal>

      <FilterCenterModal
        open={districtModalOpen}
        title="Filter by district"
        onClose={() => {
          setDistrictSearch('');
          setDistrictModalOpen(false);
        }}
        onApply={() => {
          props.onDistrictApply(draftDistrict ? [draftDistrict] : []);
          setDistrictSearch('');
          setDistrictModalOpen(false);
        }}
        onClear={() => {
          props.onDistrictApply([]);
          setDraftDistrict('');
          setDistrictSearch('');
          setDistrictModalOpen(false);
        }}
      >
        <label className="mb-3 block">
          <span className="sr-only">Search districts</span>
          <input
            type="search"
            value={districtSearch}
            onChange={(e) => setDistrictSearch(e.target.value)}
            placeholder="Search districts…"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--accent-primary)]"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--background)',
              color: 'var(--text-primary)',
            }}
            autoComplete="off"
          />
        </label>
        <ul className="m-0 max-h-[min(50vh,320px)] list-none space-y-1 overflow-y-auto p-0">
          <li>
            <button
              type="button"
              onClick={() => setDraftDistrict('')}
              className="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors"
              style={{
                borderColor: draftDistrict === '' ? 'var(--accent-primary)' : 'var(--border)',
                backgroundColor:
                  draftDistrict === ''
                    ? 'color-mix(in srgb, var(--accent-primary) 8%, var(--surface))'
                    : 'var(--surface)',
                color: 'var(--text-primary)',
              }}
            >
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2"
                style={{
                  borderColor: draftDistrict === '' ? 'var(--accent-primary)' : 'var(--border)',
                }}
                aria-hidden
              >
                {draftDistrict === '' ? (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                  />
                ) : null}
              </span>
              All districts
            </button>
          </li>
          {filteredDistricts.length === 0 ? (
            <li
              className="px-3 py-4 text-center text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              No districts match your search.
            </li>
          ) : (
            filteredDistricts.map((d) => {
            const active = draftDistrict === d.name;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => setDraftDistrict(d.name)}
                  className="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors"
                  style={{
                    borderColor: active ? 'var(--accent-primary)' : 'var(--border)',
                    backgroundColor: active
                      ? 'color-mix(in srgb, var(--accent-primary) 8%, var(--surface))'
                      : 'var(--surface)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2"
                    style={{
                      borderColor: active ? 'var(--accent-primary)' : 'var(--border)',
                    }}
                    aria-hidden
                  >
                    {active ? (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: 'var(--accent-primary)' }}
                      />
                    ) : null}
                  </span>
                  {d.name}
                </button>
              </li>
            );
          })
          )}
        </ul>
      </FilterCenterModal>
    </HomeFiltersContext.Provider>
  );
}

export function HomeFilterButtonRow({
  children,
  'aria-label': ariaLabel = 'Filters',
}: {
  children: ReactNode;
  'aria-label'?: string;
}) {
  return (
    <div
      className={FILTER_ROW_CLASS}
      style={{ scrollbarWidth: 'none' }}
      role="toolbar"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

export function HomeNearMeFilterButton({ scope = 'dish' }: { scope?: NearMeScope }) {
  const { isNearMeActive, handleNearMeClick } = useHomeFilters();
  const active = isNearMeActive(scope);
  return (
    <button
      type="button"
      onClick={() => handleNearMeClick(scope)}
      className={FILTER_BTN_CLASS}
      style={filterBtnStyle(active)}
      aria-pressed={active}
    >
      📍 Near me
    </button>
  );
}

export function HomeDishTypeFilterButton() {
  const { showDishType, selectedDishCategory, openDishModal } = useHomeFilters();
  if (!showDishType) return null;
  return (
    <button
      type="button"
      onClick={openDishModal}
      className={FILTER_BTN_CLASS}
      style={filterBtnStyle(!!selectedDishCategory)}
      aria-haspopup="dialog"
    >
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden>🍽</span>
        <span>{selectedDishCategory ?? 'Dish type'}</span>
        <span aria-hidden>▾</span>
      </span>
    </button>
  );
}

export function HomeRestaurantsFilterButton() {
  const { restaurantActiveLabel, openRestaurantModal } = useHomeFilters();
  return (
    <button
      type="button"
      onClick={openRestaurantModal}
      className={FILTER_BTN_CLASS}
      style={filterBtnStyle(!!restaurantActiveLabel)}
      aria-haspopup="dialog"
    >
      {restaurantActiveLabel ? `🏪 ${restaurantActiveLabel} ▾` : '🏪 Restaurants ▾'}
    </button>
  );
}

export function HomeDistrictFilterButton() {
  const { selectedDistricts, openDistrictModal } = useHomeFilters();
  return (
    <button
      type="button"
      onClick={openDistrictModal}
      className={FILTER_BTN_CLASS}
      style={filterBtnStyle(selectedDistricts.length > 0)}
      aria-haspopup="dialog"
    >
      {selectedDistricts.length > 0
        ? `📍 ${selectedDistricts[0]} ▾`
        : '📍 District ▾'}
    </button>
  );
}

/** Dish filters: Near me + Dish type (homepage top). */
export function HomeDishFilterRow() {
  return (
    <HomeFilterButtonRow aria-label="Dish filters">
      <HomeNearMeFilterButton />
      <HomeDishTypeFilterButton />
    </HomeFilterButtonRow>
  );
}

/** Restaurant filters: Near me + Restaurants + District (homepage mid-page). */
export function HomeRestaurantFilterRow() {
  return (
    <HomeFilterButtonRow aria-label="Restaurant filters">
      <HomeNearMeFilterButton scope="restaurant" />
      <HomeRestaurantsFilterButton />
      <HomeDistrictFilterButton />
    </HomeFilterButtonRow>
  );
}

function HomePageSectionLabel({ children }: { children: string }) {
  return (
    <p
      className="mb-2 text-[10px] font-semibold uppercase tracking-wider sm:text-xs"
      style={{ color: 'var(--text-secondary)' }}
    >
      {children}
    </p>
  );
}

/** Section label above dish rails. */
export function HomeDishesSectionLabel() {
  return <HomePageSectionLabel>DISHES</HomePageSectionLabel>;
}

/** Section label above restaurant rails. */
export function HomeRestaurantsSectionLabel() {
  return <HomePageSectionLabel>RESTAURANTS</HomePageSectionLabel>;
}

/** Single combined row for /restaurants (Near me + restaurant filters). */
export function HomeFilterBar(props: HomeFilterBarProps) {
  return (
    <HomeFiltersProvider {...props}>
      <HomeFilterButtonRow>
        <HomeNearMeFilterButton />
        {props.showDishType !== false ? <HomeDishTypeFilterButton /> : null}
        <HomeRestaurantsFilterButton />
        <HomeDistrictFilterButton />
      </HomeFilterButtonRow>
    </HomeFiltersProvider>
  );
}
