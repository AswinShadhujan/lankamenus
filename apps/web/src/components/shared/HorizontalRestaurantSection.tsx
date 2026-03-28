'use client';

import type { Restaurant } from '@/types/restaurant';
import {
  HorizontalSection,
  type HorizontalSectionProps,
} from '@/components/ui/HorizontalSection';

export type HorizontalRestaurantSectionProps = HorizontalSectionProps;

export function HorizontalRestaurantSection(props: HorizontalRestaurantSectionProps) {
  return <HorizontalSection {...props} />;
}

