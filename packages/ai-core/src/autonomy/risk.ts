import { AutonomyRiskLevel, type AutonomyRiskLevel as RiskLevel } from "./types";

const riskRanks: Record<RiskLevel, number> = {
  [AutonomyRiskLevel.Low]: 1,
  [AutonomyRiskLevel.Medium]: 2,
  [AutonomyRiskLevel.High]: 3,
  [AutonomyRiskLevel.Critical]: 4,
};

export function getRiskRank(riskLevel: RiskLevel): number {
  return riskRanks[riskLevel];
}

export function compareRiskLevel(a: RiskLevel, b: RiskLevel): -1 | 0 | 1 {
  const difference = getRiskRank(a) - getRiskRank(b);

  if (difference < 0) {
    return -1;
  }

  if (difference > 0) {
    return 1;
  }

  return 0;
}

export function isRiskAtLeast(
  riskLevel: RiskLevel,
  threshold: RiskLevel,
): boolean {
  return compareRiskLevel(riskLevel, threshold) >= 0;
}

export function maxRiskLevel(
  ...riskLevels: readonly (RiskLevel | undefined)[]
): RiskLevel | undefined {
  return riskLevels.reduce<RiskLevel | undefined>((highestRisk, riskLevel) => {
    if (riskLevel === undefined) {
      return highestRisk;
    }

    if (
      highestRisk === undefined ||
      compareRiskLevel(riskLevel, highestRisk) > 0
    ) {
      return riskLevel;
    }

    return highestRisk;
  }, undefined);
}
