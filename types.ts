export interface Point {
  x: number;
  y: number;
}

export interface GridConfig {
  origin: Point; // Center of the top-left well
  u: Point;      // Vector from one well to the next in a row
  v: Point;      // Vector from one well to the next in a column
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface WellResult {
  id: string;
  row: number;
  col: number;
  center: Point;
  avgColor: RGB;
  intensity: number; // 0-1 scale
  viability: number; // 0-100 scale
}

export interface IC50Result {
  value: number;
  units: string;
  rSquared: number;
  confidenceInterval?: [number, number]; // 95% CI
  hillSlope?: number;
  intercept?: number;
}

export interface WellAddress {
  row: number; // 0-based
  col: number; // 0-based
}

export interface ConcentrationStats {
  concentration: number;
  replicateViabilities: (number | string)[];
  avgViability: number;
  stdDev: number;
  stdErr: number;
  replicateCount: number;
}

export interface InhibitorData {
  name: string;
  concentrationUnits: string;
  positiveControlWells: WellAddress[];
  negativeControlWells: WellAddress[];
  // Maps concentration value (as a string) to the addresses of wells for that concentration.
  concentrationWellMap: Record<string, WellAddress[]>;
  stats: ConcentrationStats[];
  ic50?: IC50Result | null;
}

export interface ManualLabDataPoint {
  concentration: number;
  avgViability: number;
  stdDev: number;
}