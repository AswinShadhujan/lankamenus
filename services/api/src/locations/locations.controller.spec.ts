import { Test, TestingModule } from '@nestjs/testing';
import { LocationsController } from './locations.controller';

describe('LocationsController', () => {
  let controller: LocationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocationsController],
    }).compile();

    controller = module.get<LocationsController>(LocationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDistricts', () => {
    it('should return an array of districts with id and name', () => {
      const result = controller.getDistricts();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(25);
      for (const d of result) {
        expect(d).toHaveProperty('id');
        expect(d).toHaveProperty('name');
        expect(typeof d.id).toBe('string');
        expect(typeof d.name).toBe('string');
      }
    });

    it('should include Colombo', () => {
      const result = controller.getDistricts();
      const colombo = result.find((d) => d.name === 'Colombo');
      expect(colombo).toBeDefined();
      expect(colombo?.id).toBe('colombo');
    });
  });
});
