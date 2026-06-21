export interface MenuItemPortion {
  id: number;
  name: string;
  price: number;
  is_available: boolean;
  sort_order: number;
  serves?: number | null;
}

export interface MenuItemPortionsResponse {
  portions: MenuItemPortion[];
}
