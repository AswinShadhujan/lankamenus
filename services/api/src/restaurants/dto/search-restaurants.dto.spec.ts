import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SearchRestaurantsDto } from './search-restaurants.dto';

describe('SearchRestaurantsDto (ValidationPipe parity)', () => {
  function validateQuery(query: Record<string, unknown>) {
    const dto = plainToInstance(SearchRestaurantsDto, query);
    return validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
  }

  it('accepts lat+lng+sort=trending without radius_km (bias)', () => {
    const errors = validateQuery({
      page: '1',
      limit: '16',
      lat: '6.8658165',
      lng: '79.86375849999999',
      sort: 'trending',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts lat+lng+radius_km (strict)', () => {
    const errors = validateQuery({
      lat: '6.9',
      lng: '79.9',
      radius_km: '10',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects lat without lng', () => {
    const errors = validateQuery({ lat: '6.9' });
    expect(errors.length).toBeGreaterThan(0);
    const msg = errors.map((e) => Object.values(e.constraints ?? {}).join(' ')).join(' ');
    expect(msg).toContain('Both lat and lng');
  });

  it('rejects lng without lat', () => {
    const errors = validateQuery({ lng: '79.9' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects radius_km without lat/lng', () => {
    const errors = validateQuery({ radius_km: '5' });
    expect(errors.length).toBeGreaterThan(0);
    const msg = errors.map((e) => Object.values(e.constraints ?? {}).join(' ')).join(' ');
    expect(msg).toContain('radius_km');
  });

  it('normalizes sort=topRated to top_rated', () => {
    const dto = plainToInstance(SearchRestaurantsDto, { sort: 'topRated' });
    const errors = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors).toHaveLength(0);
    expect(dto.sort).toBe('top_rated');
  });
});
