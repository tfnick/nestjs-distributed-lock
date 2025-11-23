export class MockQueryRunner {
  connect = jest.fn();
  query = jest.fn();
  release = jest.fn();
}

export const createMockQueryRunner = () => ({
  connect: jest.fn(),
  query: jest.fn(),
  release: jest.fn(),
});