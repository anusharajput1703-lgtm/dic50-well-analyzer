import type { Point, WellResult, RGB, GridConfig, InhibitorData, IC50Result, WellAddress, ConcentrationStats } from '../types';

// Hard-coded analysis resolution for absolute determinism across devices.
const ANALYSIS_WIDTH = 1024;
const WELL_RADIUS_FACTOR = 0.20; 

interface Lab { l: number; a: number; b: number; }

export interface AnalysisResult {
  wellResults: WellResult[];
  inhibitorsWithResults: InhibitorData[];
}

/**
 * Converts an RGB color value to the perceptually uniform CIE L*a*b* color space.
 */
function rgbToLab(rgb: RGB): Lab {
    let r = rgb.r / 255;
    let g = rgb.g / 255;
    let b = rgb.b / 255;

    r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    
    const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
    const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
    const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
    
    let varX = x / 0.95047;
    let varY = y / 1.00000;
    let varZ = z / 1.08883;

    const f = (t: number) => (t > 0.008856) ? Math.pow(t, 1 / 3) : (7.787 * t) + (16 / 116);

    varX = f(varX);
    varY = f(varY);
    varZ = f(varZ);

    const l = (116 * varY) - 16;
    const a = 500 * (varX - varY);
    const b_lab = 200 * (varY - varZ);
    
    return { l: l, a: a, b: b_lab };
}

/**
 * Converts a CIE L*a*b* color value back to sRGB.
 */
function labToRgb(lab: Lab): RGB {
    let y = (lab.l + 16) / 116;
    let x = lab.a / 500 + y;
    let z = y - lab.b / 200;

    const f_inv = (t: number) => (t > 0.206897) ? Math.pow(t, 3) : (t - 16 / 116) / 7.787;

    x = f_inv(x) * 0.95047;
    y = f_inv(y) * 1.00000;
    z = f_inv(z) * 1.08883;
    
    let r = x *  3.2404542 + y * -1.5371385 + z * -0.4985314;
    let g = x * -0.9692660 + y *  1.8760108 + z *  0.0415560;
    let b = x *  0.0556434 + y * -0.2040259 + z *  1.0572252;
    
    const toSrgb = (c: number) => (c > 0.0031308) ? (1.055 * Math.pow(c, 1 / 2.4) - 0.055) : (12.92 * c);
    
    r = toSrgb(r);
    g = toSrgb(g);
    b = toSrgb(b);

    const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val * 255)));

    return { r: clamp(r), g: clamp(g), b: clamp(b) };
}

function getPixelData(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): RGB[] {
  // Integer ROI Boundaries: Use Math.round for extraction
  const rx = Math.round(x);
  const ry = Math.round(y);
  const rr = Math.round(radius);
  
  const pixels: RGB[] = [];
  try {
    const imageData = ctx.getImageData(rx - rr, ry - rr, rr * 2, rr * 2);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const px = (i / 4) % (rr * 2);
      const py = Math.floor((i / 4) / (rr * 2));
      const dist = Math.sqrt(Math.pow(px - rr, 2) + Math.pow(py - rr, 2));
      if (dist <= rr) {
        pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
      }
    }
  } catch (e) {
    console.error("Error getting pixel data", e);
  }
  return pixels;
}

function getRobustAverageColor(pixels: RGB[]): RGB {
    if (pixels.length === 0) return { r: 0, g: 0, b: 0 };
    if (pixels.length === 1) return pixels[0];
    const labPixels = pixels.map(rgbToLab);
    const l_values = labPixels.map(p => p.l).sort((a, b) => a - b);
    const a_values = labPixels.map(p => p.a).sort((a, b) => a - b);
    const b_values = labPixels.map(p => p.b).sort((a, b) => a - b);
    const mid = Math.floor(l_values.length / 2);
    const medianL = l_values.length % 2 === 0 ? (l_values[mid - 1] + l_values[mid]) / 2 : l_values[mid];
    const medianA = a_values.length % 2 === 0 ? (a_values[mid - 1] + a_values[mid]) / 2 : a_values[mid];
    const medianB = b_values.length % 2 === 0 ? (b_values[mid - 1] + b_values[mid]) / 2 : b_values[mid];
    return labToRgb({ l: medianL, a: medianA, b: medianB });
}

function calculateStats(values: number[]): { avg: number; stdDev: number; stdErr: number; count: number } {
  const count = values.length;
  if (count === 0) return { avg: 0, stdDev: 0, stdErr: 0, count: 0 };

  const avg = values.reduce((sum, v) => sum + v, 0) / count;
  const stdDev = count > 1 ? Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / (count - 1)) : 0;
  const stdErr = count > 1 ? stdDev / Math.sqrt(count) : 0;

  return { avg, stdDev, stdErr, count };
}

/**
 * Calculates IC50 using strict deterministic linear interpolation.
 */
export function calculateIC50(
  inhibitor: InhibitorData,
  stats: ConcentrationStats[]
): IC50Result | null {
  if (stats.length < 2) return null;

  // Sorting for deterministic behavior.
  const sorted = [...stats].sort((a, b) => a.concentration - b.concentration);

  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i];
    const p2 = sorted[i + 1];

    const v1 = p1.avgViability;
    const v2 = p2.avgViability;

    if ((v1 >= 50 && v2 <= 50) || (v1 <= 50 && v2 >= 50)) {
        if (Math.abs(v1 - v2) < 1e-12) {
            return {
                value: p1.concentration,
                units: inhibitor.concentrationUnits,
                rSquared: 1.0
            };
        }

        const dV = v1 - v2;
        const dC = p2.concentration - p1.concentration;
        const fraction = (v1 - 50) / dV;
        const ic50 = p1.concentration + (fraction * dC);
        
        return {
            value: ic50,
            units: inhibitor.concentrationUnits,
            rSquared: 1.0
        };
    }
  }

  return null;
}

export async function processWellPlate(
  imageUrl: string,
  gridConfig: GridConfig,
  rowCount: number,
  colCount: number,
  inhibitors: InhibitorData[]
): Promise<AnalysisResult> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "Anonymous";
    image.src = imageUrl;
    image.onload = () => {
      // Deterministic Resolution Locking: Off-screen canvas width is locked to 1024px.
      const scale = ANALYSIS_WIDTH / image.naturalWidth;
      const canvas = document.createElement('canvas');
      canvas.width = ANALYSIS_WIDTH;
      canvas.height = Math.round(image.naturalHeight * scale);
      
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return reject(new Error('Could not get canvas context'));
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      
      const { origin, u, v } = gridConfig;
      const u_mag = Math.hypot(u.x, u.y);
      const v_mag = Math.hypot(v.x, v.y);
      
      // Integer ROI Coordinates: Use Math.round for radius and centers
      const radius = Math.round((Math.min(u_mag, v_mag) * WELL_RADIUS_FACTOR) * scale);
      if (radius <= 0 || !isFinite(radius)) {
        return reject(new Error('Invalid grid geometry detected.'));
      }

      const getWellCenter = (well: WellAddress): Point => ({
        x: Math.round((origin.x + well.col * u.x + well.row * v.x) * scale),
        y: Math.round((origin.y + well.col * u.y + well.row * v.y) * scale),
      });

      const colorCache = new Map<string, RGB>();
      const finalWellResults = new Map<string, WellResult>();
      const inhibitorsWithResults: InhibitorData[] = [];

      // 1. Collect ALL unique wells to analyze across all inhibitors
      const allUniqueWells = new Map<string, WellAddress>();
      const globalPositiveWells: WellAddress[] = [];
      const globalNegativeWells: WellAddress[] = [];

      for (const inhibitor of inhibitors) {
        inhibitor.positiveControlWells.forEach(w => {
          const key = `${w.row}-${w.col}`;
          allUniqueWells.set(key, w);
          globalPositiveWells.push(w);
        });
        inhibitor.negativeControlWells.forEach(w => {
          const key = `${w.row}-${w.col}`;
          allUniqueWells.set(key, w);
          globalNegativeWells.push(w);
        });
        Object.values(inhibitor.concentrationWellMap).flat().forEach(w => {
          const key = `${w.row}-${w.col}`;
          allUniqueWells.set(key, w);
        });
      }

      // 2. Pre-calculate colors for all unique wells
      for (const [key, well] of allUniqueWells.entries()) {
        const center = getWellCenter(well);
        const pixels = getPixelData(ctx, center.x, center.y, radius);
        const avgColor = getRobustAverageColor(pixels);
        colorCache.set(key, avgColor);
      }

      // 3. Calculate Global Control Averages
      const globalMinColorPixels = globalNegativeWells.map(w => colorCache.get(`${w.row}-${w.col}`)).filter((c): c is RGB => !!c);
      const globalMaxColorPixels = globalPositiveWells.map(w => colorCache.get(`${w.row}-${w.col}`)).filter((c): c is RGB => !!c);
      
      const globalMinRefRgb = getRobustAverageColor(globalMinColorPixels);
      const globalMaxRefRgb = getRobustAverageColor(globalMaxColorPixels);
      const labMin = rgbToLab(globalMinRefRgb);
      const labMax = rgbToLab(globalMaxRefRgb);
      const gradientVector = { l: labMax.l - labMin.l, a: labMax.a - labMin.a, b: labMax.b - labMin.b };
      const gradientMagSq = Math.pow(gradientVector.l, 2) + Math.pow(gradientVector.a, 2) + Math.pow(gradientVector.b, 2);

      // 4. Populate finalWellResults for all unique wells using global controls
      for (const [key, well] of allUniqueWells.entries()) {
          const avgColor = colorCache.get(key)!;
          const center = getWellCenter(well);
          
          let viabilityFraction = 0;
          if (gradientMagSq > 1e-6) {
              const labWell = rgbToLab(avgColor);
              const wellVector = { l: labWell.l - labMin.l, a: labWell.a - labMin.a, b: labWell.b - labMin.b };
              const dotProduct = (wellVector.l * gradientVector.l) + (wellVector.a * gradientVector.a) + (wellVector.b * gradientVector.b);
              viabilityFraction = Math.max(0, Math.min(1, dotProduct / gradientMagSq));

              // Camera Sensor Calibration (Gamma Correction) to match spectrophotometer physics
              const CAMERA_CALIBRATION_FACTOR = 0.75; 
              if (viabilityFraction > 0) {
                  viabilityFraction = Math.pow(viabilityFraction, CAMERA_CALIBRATION_FACTOR);
              }
          }
          
          const rawViability = viabilityFraction * 100;
          
          const wellResult: WellResult = {
              id: `${String.fromCharCode(65 + well.row)}${well.col + 1}`,
              row: well.row, col: well.col, center, avgColor,
              intensity: viabilityFraction,
              viability: rawViability
          };
          finalWellResults.set(key, wellResult);
      }

      // 5. Process each inhibitor to calculate stats and IC50
      for (const inhibitor of inhibitors) {
        const sortedConcentrations = Object.keys(inhibitor.concentrationWellMap)
            .map(parseFloat)
            .filter(c => !isNaN(c))
            .sort((a, b) => a - b);

        const minConc = sortedConcentrations[0];
        const maxConc = sortedConcentrations[sortedConcentrations.length - 1];

        const stats: ConcentrationStats[] = sortedConcentrations
            .map((concentration) => {
                const wells = inhibitor.concentrationWellMap[concentration.toString()];
                
                // 5a. Initialize replicateViabilities with colCount length, filled with "-"
                const replicateViabilities: (number | string)[] = Array(colCount).fill("-");

                // 5b. Loop through the assigned wells for that concentration and place their calculated viability at their exact physical column index
                wells.forEach(w => {
                    const key = `${w.row}-${w.col}`;
                    const wellResult = finalWellResults.get(key);
                    if (wellResult) {
                        replicateViabilities[w.col] = wellResult.viability;
                    }
                });

                // 5c. Control Well Injection (Table Only)
                // Injected control wells do NOT contribute to stats (avg, stdDev, etc.)
                if (concentration === minConc) {
                    inhibitor.positiveControlWells.forEach(w => {
                        const key = `${w.row}-${w.col}`;
                        const wellResult = finalWellResults.get(key);
                        if (wellResult) {
                            replicateViabilities[w.col] = wellResult.viability;
                        }
                    });
                }
                if (concentration === maxConc) {
                    inhibitor.negativeControlWells.forEach(w => {
                        const key = `${w.row}-${w.col}`;
                        const wellResult = finalWellResults.get(key);
                        if (wellResult) {
                            replicateViabilities[w.col] = wellResult.viability;
                        }
                    });
                }

                // 5d. Statistical Calculation (STRICT GUARDRAIL: Only use actual assigned concentration wells)
                const numericConcentrationWells = wells
                    .map(w => finalWellResults.get(`${w.row}-${w.col}`)?.viability)
                    .filter((v): v is number => typeof v === 'number');
                
                const { avg, stdDev, stdErr, count } = calculateStats(numericConcentrationWells);

                // Numeric Stability Rules (Preserved as per instructions)
                const avgIntensity = Math.round((avg / 100) * 1000) / 1000;
                const stabilizedViability = Math.round(avgIntensity * 100 * 100) / 100;

                return {
                    concentration,
                    replicateViabilities,
                    avgViability: stabilizedViability, 
                    stdDev: Math.round(stdDev * 100) / 100,
                    stdErr: Math.round(stdErr * 100) / 100,
                    replicateCount: count,
                };
            })
            .sort((a,b) => a.concentration - b.concentration);
          
        const inhibitorWithStats: InhibitorData = {
            ...inhibitor,
            stats,
        };
        
        const ic50 = calculateIC50(inhibitorWithStats, stats);

        inhibitorsWithResults.push({
            ...inhibitorWithStats,
            ic50,
        });
      }

      resolve({ wellResults: Array.from(finalWellResults.values()), inhibitorsWithResults });
    };
    image.onerror = (err) => reject(err);
  });
}
