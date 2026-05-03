/** Row from `GET /users/me/favourites/dishes` (`{ data }`). */
export type FavouriteDish = {
  id: number;
  menu_id: number;
  name: string;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  restaurant_id: number;
  restaurant_name: string;
};
