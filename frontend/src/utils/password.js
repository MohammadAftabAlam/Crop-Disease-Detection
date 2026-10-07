// Same rule as the backend (AuthDtos.STRONG_PASSWORD)
export const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,64}$/;

export const PASSWORD_RULES = [
  { key: "profile.ruleLength", test: (value) => value.length >= 8 && value.length <= 64 },
  { key: "profile.ruleUpper", test: (value) => /[A-Z]/.test(value) },
  { key: "profile.ruleLower", test: (value) => /[a-z]/.test(value) },
  { key: "profile.ruleNumber", test: (value) => /\d/.test(value) },
  { key: "profile.ruleSpecial", test: (value) => /[@$!%*?&]/.test(value) },
];
