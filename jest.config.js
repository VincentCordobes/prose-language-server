module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "node"],
  collectCoverageFrom: ["src/**/*.ts"],
  coverageReporters: ["lcov", "text-summary"],
};
