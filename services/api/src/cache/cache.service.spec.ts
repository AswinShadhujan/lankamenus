import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { MAX_RESTAURANTS_LIST_CACHE_TTL_SECONDS } from './cache-keys';
import { CacheService } from './cache.service';

const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  setex: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  scan: jest.fn().mockResolvedValue(['0', []]),
  quit: jest.fn().mockResolvedValue('OK'),
};

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockRedis),
}));

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.scan.mockResolvedValue(['0', []]);
    mockRedis.quit.mockResolvedValue('OK');

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'REDIS_URL') return '';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('when Redis not configured', () => {
    it('isConfigured should return false', () => {
      expect(service.isConfigured()).toBe(false);
    });

    it('getClient should return null', () => {
      expect(service.getClient()).toBeNull();
    });

    it('get should return null without calling Redis', async () => {
      const result = await service.get('foo');
      expect(result).toBeNull();
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('set should not call Redis', async () => {
      await service.set('foo', 'bar');
      await service.set('foo', 'bar', 60);
      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('del should not call Redis', async () => {
      await service.del('foo');
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('delByPattern should not call Redis', async () => {
      await service.delByPattern('restaurant:*');
      expect(mockRedis.scan).not.toHaveBeenCalled();
    });
  });

  describe('when Redis configured', () => {
    beforeEach(async () => {
      const mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'REDIS_URL') return 'redis://localhost:6379';
          return undefined;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CacheService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      service = module.get<CacheService>(CacheService);
    });

    it('isConfigured should return true', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('getClient should return client', () => {
      expect(service.getClient()).not.toBeNull();
      expect(service.getClient()).toBe(mockRedis);
    });

    it('get should call Redis get and return value', async () => {
      mockRedis.get.mockResolvedValue('cached');
      const result = await service.get('key1');
      expect(mockRedis.get).toHaveBeenCalledWith('key1');
      expect(result).toBe('cached');
    });

    it('get should return null when key missing', async () => {
      mockRedis.get.mockResolvedValue(null);
      const result = await service.get('key1');
      expect(result).toBeNull();
    });

    it('set should call Redis set when no TTL', async () => {
      await service.set('key1', 'value1');
      expect(mockRedis.set).toHaveBeenCalledWith('key1', 'value1');
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('set should call Redis setex when TTL provided', async () => {
      await service.set('key1', 'value1', 120);
      expect(mockRedis.setex).toHaveBeenCalledWith('key1', 120, 'value1');
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('del should call Redis del', async () => {
      await service.del('key1');
      expect(mockRedis.del).toHaveBeenCalledWith('key1');
    });

    it('delByPattern should SCAN and del matching keys', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['1', ['restaurant:1', 'restaurant:2']])
        .mockResolvedValueOnce(['0', []]);
      await service.delByPattern('restaurant:*');
      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'restaurant:*', 'COUNT', 100);
      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
      expect(mockRedis.del).toHaveBeenCalledWith('restaurant:1', 'restaurant:2');
    });

    it('get should return null when Redis rejects', async () => {
      mockRedis.get.mockRejectedValue(new Error('ECONNREFUSED'));
      const result = await service.get('restaurants:list:x');
      expect(result).toBeNull();
    });

    it('set should cap TTL for restaurants:list:* keys', async () => {
      await service.set('restaurants:list:test', '{}', 200_000);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'restaurants:list:test',
        MAX_RESTAURANTS_LIST_CACHE_TTL_SECONDS,
        '{}',
      );
    });

    it('set should not cap TTL for non-list keys', async () => {
      await service.set('restaurant:1', '{}', 200_000);
      expect(mockRedis.setex).toHaveBeenCalledWith('restaurant:1', 200_000, '{}');
    });
  });

  describe('when Redis configured via REDIS_HOST + REDIS_PORT', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      const mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'REDIS_URL') return '';
          if (key === 'REDIS_HOST') return '127.0.0.1';
          if (key === 'REDIS_PORT') return 6380;
          return undefined;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CacheService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      service = module.get<CacheService>(CacheService);
    });

    it('isConfigured should return true and client URL is redis://host:port', () => {
      expect(service.isConfigured()).toBe(true);
      expect(Redis).toHaveBeenCalledWith(
        'redis://127.0.0.1:6380',
        expect.any(Object),
      );
    });
  });
});
