module.exports = {
  testMatch: ["<rootDir>/src/**/*.test.{ts,tsx}"],
  moduleFileExtensions: ["ts", "tsx", "js"],
  collectCoverageFrom: ["src/**/*.{ts,tsx,js}", "!src/index.tsx"],
  coverageReporters: ["lcov", "text-summary"]
};
