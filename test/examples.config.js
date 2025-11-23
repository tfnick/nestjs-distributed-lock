module.exports = {
  displayName: '示例测试',
  testMatch: ['<rootDir>/examples/**/*.spec.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  collectCoverageFrom: [
    '<rootDir>/examples/**/*.ts',
  ],
  coverageDirectory: '<rootDir>/coverage/examples',
  reporters: ['text', 'lcov', 'html'],
};