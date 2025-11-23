import { DataSource } from 'typeorm';

export class MockDataSource {
  query = jest.fn();
  createQueryRunner = jest.fn();
}

export const createMockDataSource = (): Partial<DataSource> => ({
  query: jest.fn(),
  createQueryRunner: jest.fn(),
});