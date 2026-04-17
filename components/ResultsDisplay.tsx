import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import type { WellResult, GridConfig, InhibitorData, IC50Result, WellAddress } from '../types';
import { DownloadIcon, StartOverIcon, SaveImageIcon, XIcon } from './icons';


interface ResultsDisplayProps {
  results: WellResult[];
  inhibitors: InhibitorData[];
  imageUrl?: string;
  gridConfig?: GridConfig;
  rowCount: number;
  colCount: number;
  onReset: () => void;
}

// Helper component to render a single grid table
const ResultsGrid: React.FC<{
  title: string;
  data: (string | number)[][];
  colHeaders?: (string | number)[];
  rowHeaders?: (string | number)[];
}> = ({ title, data, colHeaders, rowHeaders }) => {
  const defaultRowHeaders = Array.from({ length: data.length }, (_, i) => String.fromCharCode(65 + i));
  const defaultColHeaders = Array.from({ length: data[0]?.length || 0 }, (_, i) => i + 1);
  const displayColHeaders = colHeaders || defaultColHeaders;
  const displayRowHeaders = rowHeaders || defaultRowHeaders;

  return (
    <div className="flex-1 flex flex-col">
       <h3 className="text-xl font-bold text-center mb-2">{title}</h3>
       <div className="overflow-x-auto rounded-lg border border-[--color-border-secondary]">
        <table className="w-full text-sm text-center text-[--color-text-muted]">
            <thead className="text-xs text-[--color-table-header-text] uppercase bg-[--color-table-header-bg]">
            <tr>
                <th scope="col" className="px-2 py-2"></th>
                {displayColHeaders.map((header, index) => <th key={index} scope="col" className="px-2 py-2 whitespace-nowrap">{header}</th>)}
            </tr>
            </thead>
            <tbody>
            {data.map((row, rowIndex) => (
                <tr key={rowIndex} className="bg-[--color-background-secondary] border-b border-[--color-border-secondary] hover:bg-[--color-table-row-hover-bg]">
                <th scope="row" className="px-2 py-2 font-medium text-[--color-text-primary] whitespace-nowrap">
                    {displayRowHeaders[rowIndex]}
                </th>
                {row.map((cell, colIndex) => (
                    <td key={colIndex} className="px-2 py-2">{cell}</td>
                ))}
                </tr>
            ))}
            </tbody>
        </table>
       </div>
    </div>
  );
};


interface CurveDataPoint {
  concentration: number;
  viability: number;
  stdErr: number;
}
interface CurveModel {
  hillSlope: number;
  intercept: number;
}
interface CurveData {
  name: string;
  data: CurveDataPoint[];
  model: CurveModel | null;
  units: string;
  color: string;
  ic50?: IC50Result | null;
  isManual?: boolean;
}

const PLOT_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B'];

interface DoseResponseCurveProps {
    curves: CurveData[];
    title?: string;
    xAxisType?: 'linear' | 'log';
}

const DoseResponseCurve = React.forwardRef<SVGSVGElement, DoseResponseCurveProps>(({ curves, title, xAxisType = 'linear' }, ref) => {
  const activeCurves = curves.filter(c => c.data.length >= 2);

  const finalTitle = title || 'Dose-Response Curve';

  if (activeCurves.length === 0) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-4 border rounded-lg border-[--color-border-secondary] bg-[--color-background-primary]">
            <h3 className="text-xl font-bold text-center mb-2">{finalTitle}</h3>
            <p className="text-[--color-text-muted]">Not enough data to draw a curve.</p>
        </div>
    );
  }

  const width = 500;
  const height = 400;
  // margin.right is 60 to prevent label clipping for last values
  const margin = { top: 20, right: 60, bottom: 85, left: 70 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Aggregate and sort concentrations strictly as numbers
  const allConcentrations = useMemo(() => {
    return (activeCurves.flatMap(c => c.data.map(d => d.concentration)) as number[])
      .filter(c => c > 0)
      .sort((a: number, b: number) => a - b);
  }, [activeCurves]);

  const uniqueConcentrations = useMemo(() => [...new Set(allConcentrations)], [allConcentrations]);

  if (allConcentrations.length === 0) {
      return (
          <div className="flex-1 flex flex-col items-center justify-center p-4 border rounded-lg border-[--color-border-secondary] bg-[--color-background-primary]">
              <h3 className="text-xl font-bold text-center mb-2">{finalTitle}</h3>
              <p className="text-[--color-text-muted]">No concentration data available to plot.</p>
          </div>
      );
  }
  
  // Scale range limits
  const xMinVal = allConcentrations[0] as number;
  const xMaxVal = allConcentrations[allConcentrations.length - 1] as number;

  const xMinLog = Math.log10(xMinVal);
  const xMaxLog = Math.log10(xMaxVal);

  const xScale = useCallback((x: number): number => {
      if (xAxisType === 'linear') {
          const range = xMaxVal - xMinVal;
          if (range === 0) return innerWidth / 2;
          return ((x - xMinVal) / range) * innerWidth;
      } else {
          // Scientific Logarithmic Spacing
          if (x <= 0) return 0;
          const logX = Math.log10(x);
          const range = xMaxLog - xMinLog;
          if (range === 0) return innerWidth / 2;
          return ((logX - xMinLog) / range) * innerWidth;
      }
  }, [xAxisType, xMinVal, xMaxVal, xMinLog, xMaxLog, innerWidth]);
  
  const yScale = (y: number): number => innerHeight - (y / 100) * innerHeight;

  // X Axis Ticks Generation Logic
  const xTickConfig = useMemo(() => {
    // Single-line display with 0° rotation.
    // Collision Handling: Auto-Skip labels if they overlap physically.
    const minPixelGap = 55; // Required horizontal gap to prevent label overlap
    let lastVisibleX = -Infinity;

    return uniqueConcentrations.map((val) => {
        const x = xScale(val);
        const canShow = (x - lastVisibleX) >= minPixelGap;
        if (canShow) {
            lastVisibleX = x;
        }
        
        return {
            value: val,
            showLabel: canShow,
            fontSize: uniqueConcentrations.length > 6 ? 10 : 11
        };
    });
  }, [uniqueConcentrations, xScale]);

  // Minor Log Ticks for visual standard
  const minorLogTicks = useMemo(() => {
    if (xAxisType !== 'log') return [];
    const ticks: number[] = [];
    const startDecade = Math.floor(xMinLog);
    const endDecade = Math.ceil(xMaxLog);
    for (let d = startDecade; d <= endDecade; d++) {
      const base = Math.pow(10, d);
      for (let i = 2; i <= 9; i++) {
        const val = base * i;
        if (val >= xMinVal * 0.9 && val <= xMaxVal * 1.1) ticks.push(val);
      }
    }
    return ticks;
  }, [xAxisType, xMinLog, xMaxLog, xMinVal, xMaxVal]);

  const yTicks = [0, 25, 50, 75, 100];
  const unitsString = [...new Set(activeCurves.map(c => c.units).filter(Boolean))].join(', ');
  
  const formatTickLabel = (tick: number): string => {
    if (tick === 0) return "0";
    if (tick < 0.01 || tick >= 10000) return tick.toExponential(0);
    return Number.isInteger(tick) ? tick.toString() : tick.toPrecision(3).replace(/\.?0+$/, "");
  };

  const xAxisTitle = xAxisType === 'log' 
      ? <text transform={`translate(${innerWidth / 2}, ${innerHeight + 75})`} textAnchor="middle" fontSize="16" fontWeight="bold">Concentration (log scale, {unitsString})</text>
      : <text transform={`translate(${innerWidth / 2}, ${innerHeight + 75})`} textAnchor="middle" fontSize="16" fontWeight="bold">Concentration ({unitsString})</text>;


  return (
    <div className="flex-1 flex flex-col">
      <h3 className="text-xl font-bold text-center mb-2">{finalTitle}</h3>
      <div className="p-4 border rounded-lg border-[--color-border-secondary] bg-[--color-background-primary] flex flex-col justify-center items-center relative overflow-hidden">
        <svg ref={ref} width={width} height={height + 25} viewBox={`0 0 ${width} ${height + 25}`} className="text-[--color-text-primary]">
          <g transform={`translate(${margin.left},${margin.top})`}>
            {/* Axes */}
            <line x1="0" y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" />
            <line x1="0" y1="0" x2="0" y2={innerHeight} stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" />
            
            {/* Horizontal Grid (Viability) */}
            {yTicks.map(tick => (
                <g key={`y-tick-${tick}`} transform={`translate(0, ${yScale(tick)})`}>
                    <line x1="-5" x2={innerWidth} stroke="currentColor" strokeOpacity="0.1" />
                    <text x="-10" dy=".32em" textAnchor="end" fontSize="14">{tick}</text>
                </g>
            ))}

            {/* Vertical Grid & X-Axis Ticks (Forced Single-Line Horizontal + Auto-Skip) */}
            {xTickConfig.map((tick, i) => {
                const x = xScale(tick.value);
                if (x < -1 || x > innerWidth + 1) return null;
                return (
                    <g key={`x-tick-${i}`} transform={`translate(${x}, ${innerHeight})`}>
                        <line y2="8" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" />
                        {tick.showLabel && (
                          <text 
                              y={15} 
                              x="0"
                              textAnchor="middle" 
                              fontSize={tick.fontSize} 
                              fontWeight="500"
                              // Horizontal labels only (0° rotation)
                              dy="8"
                          >
                              {formatTickLabel(tick.value)}
                          </text>
                        )}
                        {/* Grid line for primary ticks */}
                        <line y1={-innerHeight} y2="0" stroke="currentColor" strokeOpacity="0.05" />
                    </g>
                );
            })}

            {/* Logarithmic Minor Tick Marks */}
            {xAxisType === 'log' && minorLogTicks.map((tick, i) => {
                const x = xScale(tick);
                if (x < 0 || x > innerWidth) return null;
                return (
                    <line key={`minor-${i}`} x1={x} y1={innerHeight} x2={x} y2={innerHeight + 4} stroke="currentColor" strokeOpacity="0.4" />
                );
            })}
            
            {/* Axis Labels */}
            {xAxisTitle}
            <text transform={`rotate(-90)`} x={-innerHeight / 2} y={-55} textAnchor="middle" fontSize="16" fontWeight="bold">Cell Viability (%)</text>

            {/* Baseline for 50% Threshold */}
            <line x1="0" y1={yScale(50)} x2={innerWidth} y2={yScale(50)} stroke="currentColor" strokeDasharray="4,4" strokeOpacity="0.2" />
            
            {/* IC50 Intersection Markers */}
            {activeCurves.map(curve => {
              if (!curve.ic50) return null;
              const ic50Value = curve.ic50.value;
              const ic50_x = xScale(ic50Value);
              const ic50_y = yScale(50);
              
              if (ic50_x < 0 || ic50_x > innerWidth) return null;

              return (
                <g key={`ic50-marker-${curve.name}`} className="pointer-events-none">
                  {/* Vertical drop to X-axis */}
                  <line 
                    x1={ic50_x} y1={ic50_y} x2={ic50_x} y2={innerHeight} 
                    stroke="#3B82F6" strokeWidth="2" strokeDasharray="4,4" strokeOpacity="0.9" 
                  />
                  {/* Horizontal line from Y-axis */}
                  <line 
                    x1={0} y1={ic50_y} x2={ic50_x} y2={ic50_y} 
                    stroke="#3B82F6" strokeWidth="2" strokeDasharray="4,4" strokeOpacity="0.9" 
                  />
                  <circle cx={ic50_x} cy={ic50_y} r="3.5" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="1" />
                </g>
              );
            })}

            {/* Point-to-Point Piecewise Linear Paths */}
            {activeCurves.map(curve => (
              <g key={curve.name}>
                <path d={(() => {
                    const sortedData = [...curve.data]
                        .filter(d => d.concentration > 0)
                        .sort((a, b) => a.concentration - b.concentration);
                    
                    const points = sortedData.map(d => `${xScale(d.concentration)},${yScale(d.viability)}`);
                    return points.length > 0 ? `M ${points.join(' L ')}` : "";
                })()} 
                fill="none" 
                stroke={curve.color} 
                strokeWidth="2.5" 
                strokeOpacity="0.9"
                strokeDasharray={curve.isManual ? '6,3' : 'none'}
                />
                
                {curve.data.map((d, i) => {
                    if (d.concentration <= 0) return null;
                    const cx = xScale(d.concentration);
                    const cy = yScale(d.viability);
                    const errorTop = yScale(d.viability + d.stdErr);
                    const errorBottom = yScale(d.viability - d.stdErr);

                    return (
                        <g key={`p-${i}`} className="pointer-events-none">
                            {/* Error Bars */}
                            <line x1={cx} y1={errorTop} x2={cx} y2={errorBottom} stroke={curve.color} strokeWidth={1.5} />
                            <line x1={cx - 3} y1={errorTop} x2={cx + 3} y2={errorTop} stroke={curve.color} strokeWidth={1.5} />
                            <line x1={cx - 3} y1={errorBottom} x2={cx + 3} y2={errorBottom} stroke={curve.color} strokeWidth={1.5} />
                            {/* Data Points */}
                            {curve.isManual ? (
                                <rect x={cx - 4} y={cy - 4} width="8" height="8" fill="var(--color-background-primary)" stroke={curve.color} strokeWidth={1.5} />
                            ) : (
                                <circle cx={cx} cy={cy} r="4.5" fill={curve.color} stroke="var(--color-background-primary)" strokeWidth="1" />
                            )}
                        </g>
                    );
                })}
              </g>
            ))}

            {/* IC50 Value Legends (Rounded to 1 decimal place) */}
            {activeCurves.map((curve, index) => (
              curve.ic50 && (
                <text
                    key={`ic50-label-${curve.name}`}
                    x={innerWidth - 10}
                    y={25 + index * 25}
                    textAnchor="end"
                    fontSize="18"
                    fontWeight="bold"
                    fill={curve.color}
                    style={{textShadow: `0px 0px 4px var(--color-background-secondary)`}}
                >
                    {activeCurves.length > 1 ? `${curve.name}: ` : ''}dIC
                    <tspan dy="5" fontSize="14">50</tspan>
                    <tspan dy="-5"> = {curve.ic50.value.toFixed(1)} {curve.ic50.units}</tspan>
                </text>
              )
            ))}

            {/* Method Footnote */}
            <text 
              x={innerWidth} 
              y={innerHeight + 95} 
              textAnchor="end" 
              fontSize="10" 
              fontStyle="italic" 
              fill="var(--color-text-muted)"
              className="opacity-70"
            >
              Method: Deterministic Linear Interpolation
            </text>
          </g>
        </svg>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-6 text-lg w-full">
            {activeCurves.map(curve => (
                <div key={curve.name} className="flex items-center">
                    <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: curve.color }}></div>
                    <span className="font-semibold text-xl">{curve.name}</span>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
});
DoseResponseCurve.displayName = 'DoseResponseCurve';


export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ results, inhibitors, imageUrl, gridConfig, rowCount, colCount, onReset }) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphRef = useRef<SVGSVGElement>(null);
  const exportLogGraphRef = useRef<SVGSVGElement>(null);
  const exportLinearGraphRef = useRef<SVGSVGElement>(null);

  const [selectedWell, setSelectedWell] = useState<WellResult | null>(null);
  const [magnifierAnchor, setMagnifierAnchor] = useState<{row: number, col: number} | null>(null);
  const [graphScale, setGraphScale] = useState<'linear' | 'log'>('log');
  
  // Single source of truth for analysis resolution
  const ANALYSIS_WIDTH = 1024;

  const wellMap = useMemo(() => {
    const map = new Map<string, WellResult>();
    results.forEach(r => map.set(`${r.row}-${r.col}`, r));
    return map;
  }, [results]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !image.naturalWidth) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // COORDINATE LOCK: Set internal canvas resolution to match analysis space (1024px width)
    // CSS handle the responsive scaling to match the visual image area
    const analysisScale = ANALYSIS_WIDTH / image.naturalWidth;
    canvas.width = ANALYSIS_WIDTH;
    canvas.height = Math.round(image.naturalHeight * analysisScale);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Reuse well results precisely as generated in the processing stage
    results.forEach(well => {
      const { center, avgColor, viability } = well;
      
      // well.center is already in ANALYSIS_WIDTH space from wellPlateProcessor.ts
      const displayX = center.x;
      const displayY = center.y;
      
      // Calculate radius in analysis space using the same ROI factor (20% of pitch)
      const WELL_RADIUS_FACTOR = 0.20;
      let displayRadius = 0;
      if (gridConfig) {
        const u_mag = Math.hypot(gridConfig.u.x, gridConfig.u.y);
        const v_mag = Math.hypot(gridConfig.v.x, gridConfig.v.y);
        displayRadius = Math.round(Math.min(u_mag, v_mag) * WELL_RADIUS_FACTOR * analysisScale);
      }
      
      const brightness = (avgColor.r * 299 + avgColor.g * 587 + avgColor.b * 114) / 1000;
      
      // Draw well circle overlay at analysis center
      ctx.beginPath();
      ctx.arc(displayX, displayY, displayRadius, 0, 2 * Math.PI);
      const viabilityColor = `hsl(${(well.viability / 100) * 120}, 100%, 50%)`;
      ctx.strokeStyle = viabilityColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // STRICT CENTERING: Enforce mathematical center at (displayX, displayY)
      const fontSize = Math.max(8, Math.floor(displayRadius / 1.5));
      ctx.fillStyle = brightness > 128 ? 'black' : 'white';
      ctx.font = `bold ${fontSize}px ui-sans-serif, system-ui, -apple-system, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Draw text exactly at center point with NO vertical or horizontal offsets
      ctx.fillText(viability.toFixed(0), displayX, displayY);
    });
  }, [results, gridConfig]);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    const handleResize = () => draw();
    if (image.complete) draw();
    else image.addEventListener('load', draw);
    window.addEventListener('resize', handleResize);
    return () => {
      if (image) image.removeEventListener('load', draw);
      window.removeEventListener('resize', handleResize);
    };
  }, [draw]);

  const viabilityData = useMemo(() => {
    if (rowCount === 0 || colCount === 0) return [];
    const grid: number[][] = Array(rowCount).fill(0).map(() => Array(colCount).fill(NaN));
    results.forEach(r => {
        if (r.row < rowCount && r.col < colCount) {
            grid[r.row][r.col] = r.viability;
        }
    });
    return grid;
  }, [results, rowCount, colCount]);
  
  const graphTitle = useMemo(() => {
    const baseNames = [...new Set(inhibitors.map(i => i.name.replace(' (Manual Data)', '').trim()).filter(Boolean))];
    if (baseNames.length === 1 && baseNames[0]) {
      return `Dose-Response Curve for ${baseNames[0]}`;
    }
    return 'Dose-Response Curve';
  }, [inhibitors]);

  const curveData = useMemo((): CurveData[] => {
    return inhibitors
      .filter(inh => inh.name.trim() !== '')
      .map((inhibitor, index) => {
        const isManualData = inhibitor.name.includes('(Manual Data)') || (results.length === 0);
        
        const dataPoints = inhibitor.stats
          .filter(s => s.concentration > 0 && (isManualData || s.replicateCount > 0))
          .map(s => ({
            concentration: s.concentration,
            viability: s.avgViability,
            stdErr: s.stdErr,
          }));

        const model = null; 
          
        const displayName = (inhibitor.name.includes('(Manual Data)'))
            ? `${inhibitor.name.replace(' (Manual Data)', '')} (Lab Data)`
            : inhibitor.name;

        return {
          name: displayName,
          data: dataPoints,
          model: model,
          units: inhibitor.concentrationUnits,
          color: PLOT_COLORS[index % PLOT_COLORS.length],
          ic50: inhibitor.ic50,
          isManual: isManualData,
        };
      });
  }, [inhibitors, results.length]);

  const handleDownloadCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "dIC50 Summary\n";
    csvContent += "Inhibitor Name,dIC50,Units,R-Squared\n";
    inhibitors.forEach(inh => {
        const isManualData = inh.name.includes('(Manual Data)');
        const displayName = isManualData
          ? inh.name.replace(' (Manual Data)', ' (Lab Data)')
          : inh.name;
        // REQUIREMENT: Round IC50 for output.
        const ic50 = inh.ic50?.value.toFixed(1) ?? 'N/A';
        const r2 = inh.ic50?.rSquared.toFixed(4) ?? 'N/A';
        csvContent += `"${displayName}",${ic50},${inh.concentrationUnits},${r2}\n`;
    });
    
    csvContent += "\n";
    
    csvContent += "Dose-Response Data Points\n";
    csvContent += "Inhibitor Name,Concentration,Units,Avg Viability,Std Dev,Std Err,N\n";
    inhibitors.forEach(inh => {
      const isManualData = inh.name.includes('(Manual Data)');
      const displayName = isManualData
        ? inh.name.replace(' (Manual Data)', ' (Lab Data)')
        : inh.name;
      inh.stats.forEach(s => {
        const nValue = s.replicateCount > 0 ? s.replicateCount : 'N/A';
        csvContent += `"${displayName}",${s.concentration},${inh.concentrationUnits},${s.avgViability.toFixed(3)},${s.stdDev.toFixed(3)},${s.stdErr.toFixed(3)},${nValue}\n`;
      });
    });

    if (viabilityData.length > 0) {
        csvContent += "\n";
        csvContent += "Cell Viability (%)\n";
        csvContent += `Row,${Array.from({ length: colCount }, (_, i) => `Col ${i + 1}`).join(',')}\n`;
        viabilityData.forEach((row, rowIndex) => {
            const rowLetter = String.fromCharCode(65 + rowIndex);
            const rowData = row.map(cell => isNaN(cell) ? '' : cell.toFixed(2)).join(',');
            csvContent += `${rowLetter},${rowData}\n`;
        });
    }
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "well_plate_analysis.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveGraph = (ref: React.RefObject<SVGSVGElement>, type: 'log' | 'linear') => {
    const svgNode = ref.current;
    if (!svgNode) return;

    const clonedSvgNode = svgNode.cloneNode(true) as SVGSVGElement;

    const rootStyles = getComputedStyle(document.documentElement);
    const variables = [
        '--color-text-primary',
        '--color-background-primary',
        '--color-background-secondary',
    ];
    let cssText = ':root {\n';
    variables.forEach(v => {
        cssText += `  ${v}: ${rootStyles.getPropertyValue(v).trim()};\n`;
    });
    cssText += '}';

    const styleEl = document.createElement('style');
    styleEl.textContent = cssText;
    clonedSvgNode.insertBefore(styleEl, clonedSvgNode.firstChild);

    const svgString = new XMLSerializer().serializeToString(clonedSvgNode);
    
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    let filename = 'dose-response-curve.svg';
    const activeInhibitors = inhibitors.filter(i => i.stats.length > 0);
    const suffix = type === 'log' ? 'LogGraph' : 'LinearGraph';
    
    if (activeInhibitors.length === 1) {
        const inh = activeInhibitors[0];
        const safeName = inh.name.replace(/[^a-zA-Z0-9-_]/g, '_'); 
        if (inh.ic50) {
           filename = `${safeName}_${suffix}_IC50_${inh.ic50.value.toFixed(1)}${inh.concentrationUnits}.svg`;
        } else {
           filename = `${safeName}_${suffix}.svg`;
        }
    } else if (activeInhibitors.length > 1) {
        filename = `Combined_${suffix}.svg`;
    }

    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const formatIC50 = (inhibitor: InhibitorData): React.ReactNode => {
    const result = inhibitor.ic50;
    const stats = inhibitor.stats;

    if (result) {
        return (
          // REQUIREMENT: Round the displayed value to 1 decimal place.
          <span className="text-3xl font-bold">{result.value.toFixed(1)} {result.units}</span>
        );
    }
    
    if (stats.length >= 2) {
        return <span className="text-sm font-bold text-red-500 uppercase tracking-tighter">IC50 is outside the tested concentration range.</span>;
    }

    return <span className="text-sm font-bold text-yellow-600 uppercase">N/A (Minimum 2 points required)</span>;
  };

  const handleMobileGridTap = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault(); 
      
      const container = e.currentTarget;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const PADDING = 16;
      const CELL_SIZE = 48;
      const GAP = 16;
      const STRIDE = CELL_SIZE + GAP;

      let minDistance = Infinity;
      let closestWell: WellResult | null = null;

      for (let r = 0; r < rowCount; r++) {
          for (let c = 0; c < colCount; c++) {
              const cx = PADDING + c * STRIDE + CELL_SIZE / 2;
              const cy = PADDING + r * STRIDE + CELL_SIZE / 2;
              
              const distance = Math.hypot(x - cx, y - cy);
              
              if (distance < minDistance) {
                  minDistance = distance;
                  const well = wellMap.get(`${r}-${c}`);
                  if (well) {
                      closestWell = well;
                  }
              }
          }
      }

      if (closestWell && minDistance < STRIDE) {
          setMagnifierAnchor({ row: closestWell.row, col: closestWell.col });
      }
  }, [rowCount, colCount, wellMap]);
  
  const magnifiedWells = useMemo(() => {
    if (!magnifierAnchor) return [];
    const { row: cr, col: cc } = magnifierAnchor;
    const wells = [];
    
    for (let r = cr - 1; r <= cr + 1; r++) {
        for (let c = cc - 1; c <= cc + 1; c++) {
            if (r >= 0 && r < rowCount && c >= 0 && c < colCount) {
                const well = wellMap.get(`${r}-${c}`);
                wells.push({ r, c, well });
            } else {
                 wells.push({ r, c, well: null });
            }
        }
    }
    return wells;
  }, [magnifierAnchor, rowCount, colCount, wellMap]);

  const hasPlateImage = !!imageUrl;

  return (
    <div className="space-y-8">
      {/* Magnifier Modal */}
      {magnifierAnchor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setMagnifierAnchor(null)}>
            <div className="bg-[--color-background-primary] p-6 rounded-2xl shadow-2xl w-auto max-w-[90vw] overflow-hidden transform transition-all scale-100" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-xl text-[--color-text-primary]">Tap to Select</h3>
                     <button onClick={() => setMagnifierAnchor(null)} className="p-2 rounded-full hover:bg-[--color-button-secondary-hover-bg]">
                        <XIcon className="w-6 h-6 text-[--color-text-muted]" />
                     </button>
                </div>
                
                <div className="grid gap-6 p-2 justify-center" style={{ gridTemplateColumns: 'repeat(3, auto)' }}>
                    {magnifiedWells.map(({ r, c, well }, idx) => {
                         if (!well && (r < 0 || r >= rowCount || c < 0 || c >= colCount)) {
                             return <div key={idx} className="w-[60px] h-[60px]" />; 
                         }
                         
                         const isSelected = selectedWell?.row === r && selectedWell?.col === c;
                         const isAnchor = magnifierAnchor.row === r && magnifierAnchor.col === c;
                         
                         return (
                            <button
                                key={idx}
                                onClick={() => {
                                    if (well) {
                                        setSelectedWell(well);
                                        setMagnifierAnchor(null);
                                    }
                                }}
                                className={`
                                    w-[60px] h-[60px] flex flex-col items-center justify-center rounded-xl transition-all shadow-md relative
                                    ${isSelected ? 'ring-4 ring-[--color-accent-primary] bg-[--color-background-tertiary-hover]' : 'bg-[--color-background-secondary] hover:bg-[--color-background-tertiary]'}
                                    ${isAnchor ? 'ring-2 ring-dashed ring-opacity-50 ring-[--color-text-muted]' : ''}
                                `}
                            >
                                {well ? (
                                    <>
                                        <div 
                                            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-[10px] font-bold text-white shadow-sm mb-1"
                                            style={{ 
                                                backgroundColor: `hsl(${(well.viability / 100) * 120}, 100%, 40%)` 
                                            }}
                                        >
                                            {well.viability.toFixed(0)}
                                        </div>
                                        <span className="text-[10px] font-mono text-[--color-text-muted]">{well.id}</span>
                                    </>
                                ) : (
                                   <div className="w-2 h-2 rounded-full bg-gray-200" />
                                )}
                            </button>
                         );
                    })}
                </div>
                <p className="text-center text-sm text-[--color-text-muted] mt-4">Confirm selection from magnified view</p>
            </div>
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-3xl font-bold">Analysis Results</h2>
        <div className="flex gap-2">
            <button onClick={() => handleSaveGraph(exportLogGraphRef, 'log')} className="flex items-center gap-2 px-4 py-2 bg-[--color-button-secondary-bg] text-[--color-button-secondary-text] font-semibold rounded-lg shadow-sm hover:bg-[--color-button-secondary-hover-bg] transition-colors" title="Download Log-Scale Dose-Response Curve">
              <SaveImageIcon className="w-5 h-5" />
              Download Log Graph
            </button>
            <button onClick={() => handleSaveGraph(exportLinearGraphRef, 'linear')} className="flex items-center gap-2 px-4 py-2 bg-[--color-button-secondary-bg] text-[--color-button-secondary-text] font-semibold rounded-lg shadow-sm hover:bg-[--color-button-secondary-hover-bg] transition-colors" title="Download Dose-Response Curve with Linear X-Axis">
              <SaveImageIcon className="w-5 h-5" />
              Download Concentration Graph
            </button>
            <button onClick={handleDownloadCSV} className="flex items-center gap-2 px-4 py-2 bg-[--color-button-secondary-bg] text-[--color-button-secondary-text] font-semibold rounded-lg shadow-sm hover:bg-[--color-button-secondary-hover-bg] transition-colors"><DownloadIcon className="w-5 h-5" />Download CSV</button>
            <button onClick={onReset} className="flex items-center gap-2 px-4 py-2 bg-[--color-accent-primary] text-[--color-accent-primary-text] font-semibold rounded-lg shadow-sm hover:bg-[--color-accent-primary-hover] transition-colors"><StartOverIcon className="w-5 h-5" />Start Over</button>
        </div>
      </div>
      
      <div className="space-y-4">
        <h3 className="text-2xl font-bold text-center">dIC<sub>50</sub> Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {inhibitors.filter(inh => inh.name.trim() !== '').map((inhibitor, index) => {
            return (
              <div key={index} className="p-4 rounded-lg border border-[--color-border-secondary] bg-[--color-background-tertiary] shadow-md text-center">
                <h4 className="text-lg font-semibold" style={{ color: PLOT_COLORS[index % PLOT_COLORS.length] }}>
                  {inhibitor.name.includes('(Manual Data)') ? `${inhibitor.name.replace(' (Manual Data)', '')} (Lab Data)` : inhibitor.name}
                </h4>
                <div className="text-sm text-[--color-text-muted] mt-2">dIC<sub>50</sub> Value</div>
                <div className="mt-1">{formatIC50(inhibitor)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="flex-1 flex flex-col items-center">
          {hasPlateImage ? (
            <>
              <h3 className="text-xl font-bold text-center mb-2">Processed Plate</h3>
              <div className="hidden md:inline-block relative border rounded-lg overflow-hidden shadow-md min-w-[200px] min-h-[150px]">
                <img ref={imageRef} src={imageUrl} alt="Processed Plate" className="max-w-full max-h-[60vh] block" />
                <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none"></canvas>
              </div>

              <div className="md:hidden w-full overflow-x-auto pb-4">
                  <style>{`
                      @media (max-width: 768px) {
                          .mobile-plate-grid {
                              display: grid;
                              width: max-content;
                              padding: 16px;
                              gap: 16px;
                              justify-content: start;
                          }
                          .mobile-well-cell {
                              width: 48px;
                              height: 48px;
                              pointer-events: none;
                          }
                      }
                  `}</style>
                  <div 
                      className="mobile-plate-grid" 
                      style={{ gridTemplateColumns: `repeat(${colCount}, 48px)` }}
                      onClick={handleMobileGridTap}
                  >
                      {Array.from({ length: rowCount }).map((_, r) => 
                          Array.from({ length: colCount }).map((_, c) => {
                              const well = wellMap.get(`${r}-${c}`);
                              const isSelected = selectedWell?.row === r && selectedWell?.col === c;
                              
                              return (
                                  <div
                                      key={`${r}-${c}`}
                                      className={`
                                          mobile-well-cell
                                          flex items-center justify-center rounded-lg transition-all
                                          ${isSelected ? 'ring-2 ring-[--color-accent-primary] bg-[--color-background-tertiary-hover]' : 'bg-[--color-background-secondary]'}
                                      `}
                                      aria-label={well ? `Select Well ${well.id}` : `Empty Well`}
                                  >
                                      {well ? (
                                          <div 
                                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                                              style={{ 
                                                  backgroundColor: `hsl(${(well.viability / 100) * 120}, 100%, 40%)` 
                                              }}
                                          >
                                              {well.viability.toFixed(0)}
                                          </div>
                                      ) : (
                                         <div className="w-2 h-2 rounded-full bg-gray-200" />
                                      )}
                                  </div>
                              );
                          })
                      )}
                  </div>
                  <p className="text-center text-xs text-[--color-text-muted] mt-2">Tap any well to open the selection magnifier.</p>
              </div>

              {selectedWell && (
                  <div className="mt-4 p-4 border rounded-lg bg-[--color-background-tertiary] w-full text-center md:text-left animate-in fade-in slide-in-from-top-4">
                      <h4 className="text-lg font-bold mb-2">Well {selectedWell.id} Details</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                              <span className="text-[--color-text-muted]">Viability:</span>
                              <span className="ml-2 font-mono font-bold">{selectedWell.viability.toFixed(2)}%</span>
                          </div>
                          <div>
                              <span className="text-[--color-text-muted]">Intensity:</span>
                              <span className="ml-2 font-mono">{selectedWell.intensity.toFixed(3)}</span>
                          </div>
                      </div>
                  </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 bg-[--color-background-accent] rounded-xl border border-dashed border-[--color-accent-primary]/30 text-center">
                <p className="text-[--color-text-muted] italic">Plate image visualization is only available in AI analysis mode.</p>
            </div>
          )}

        </div>
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex justify-center items-center gap-4 py-2">
            <span className="text-sm font-bold uppercase tracking-widest text-[--color-text-muted]">Graph Scale:</span>
            <div className="inline-flex rounded-xl bg-[--color-background-tertiary] p-1 shadow-inner">
              <button 
                onClick={() => setGraphScale('linear')}
                className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all uppercase tracking-tighter ${graphScale === 'linear' ? 'bg-[--color-accent-primary] text-white shadow-md' : 'text-[--color-text-muted] hover:text-[--color-text-primary]'}`}
              >
                Linear
              </button>
              <button 
                onClick={() => setGraphScale('log')}
                className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all uppercase tracking-tighter ${graphScale === 'log' ? 'bg-[--color-accent-primary] text-white shadow-md' : 'text-[--color-text-muted] hover:text-[--color-text-primary]'}`}
              >
                Logarithmic
              </button>
            </div>
          </div>
          <DoseResponseCurve curves={curveData} ref={graphRef} title={graphTitle} xAxisType={graphScale} />
        </div>
      </div>

      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', visibility: 'hidden' }}>
        <DoseResponseCurve curves={curveData} ref={exportLogGraphRef} title={graphTitle} xAxisType="log" />
        <DoseResponseCurve curves={curveData} ref={exportLinearGraphRef} title={graphTitle} xAxisType="linear" />
      </div>

      <div className="space-y-8 pt-8 max-w-6xl mx-auto">
        <h3 className="text-2xl font-bold text-center">Detailed Dose-Response Data</h3>
        <div className="grid grid-cols-1 gap-12 items-start">
          {inhibitors.filter(inh => inh.stats.length > 0).map((inhibitor, index) => {
            const isManualData = inhibitor.name.includes('(Manual Data)') || results.length === 0;
            const displayName = inhibitor.name.includes('(Manual Data)')
                ? `${inhibitor.name.replace(' (Manual Data)', '')} (Lab Data)`
                : inhibitor.name;
            
            if (isManualData) {
              return (
                <div key={inhibitor.name} className="flex-1 flex flex-col">
                  <h4 className="text-xl font-bold text-center mb-2" style={{ color: PLOT_COLORS[index % PLOT_COLORS.length] }}>{displayName}</h4>
                  <div className="overflow-x-auto rounded-lg border border-[--color-border-secondary]">
                    <table className="w-full text-sm text-center text-[--color-text-muted]">
                      <thead className="text-xs text-[--color-table-header-text] uppercase bg-[--color-table-header-bg]">
                        <tr>
                          <th scope="col" className="px-2 py-2 whitespace-nowrap">Concentration</th>
                          <th scope="col" className="px-2 py-2 whitespace-nowrap">Avg. Viability (%)</th>
                          <th scope="col" className="px-2 py-2 whitespace-nowrap">Std. Dev.</th>
                          <th scope="col" className="px-2 py-2 whitespace-nowrap">N</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inhibitor.stats.map((stat) => (
                          <tr key={stat.concentration} className="bg-[--color-background-secondary] border-b border-[--color-border-secondary] hover:bg-[--color-table-row-hover-bg]">
                            <th scope="row" className="px-2 py-2 font-medium text-[--color-text-primary] whitespace-nowrap">
                              {stat.concentration} {inhibitor.concentrationUnits}
                            </th>
                            <td className="px-2 py-2">{stat.avgViability.toFixed(2)}</td>
                            <td className="px-2 py-2">{stat.stdDev.toFixed(2)}</td>
                            <td className="px-2 py-2">{stat.replicateCount > 0 ? stat.replicateCount : 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            }

            const replicateHeaders = Array.from({ length: colCount }, (_, i) => `Replicate ${i + 1}`);

            return (
              <div key={inhibitor.name} className="flex-1 flex flex-col">
                <h4 className="text-xl font-bold text-center mb-2" style={{ color: PLOT_COLORS[index % PLOT_COLORS.length] }}>
                  {`${displayName} Cell Viability (%)`}
                </h4>
                <div className="rounded-lg border border-[--color-border-secondary] overflow-x-auto">
                  <table className="w-full text-sm text-center text-[--color-text-muted]">
                    <thead className="text-xs text-[--color-table-header-text] uppercase bg-[--color-table-header-bg]">
                      <tr>
                        <th scope="col" className="px-2 py-1 whitespace-nowrap">Concentration</th>
                        {replicateHeaders.map(header => (
                          <th key={header} scope="col" className="px-2 py-1 whitespace-nowrap">{header}</th>
                        ))}
                        <th scope="col" className="px-2 py-1 whitespace-nowrap font-bold">Avg. Viability (%)</th>
                        <th scope="col" className="px-2 py-1 whitespace-nowrap font-bold">Std. Dev.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inhibitor.stats.map((stat) => (
                        <tr key={stat.concentration} className="bg-[--color-background-secondary] border-b border-[--color-border-secondary] hover:bg-[--color-table-row-hover-bg]">
                          <th scope="row" className="px-2 py-1 font-medium text-[--color-text-primary] whitespace-nowrap">
                            {stat.concentration} {inhibitor.concentrationUnits}
                          </th>
                          {stat.replicateViabilities.map((val, i) => (
                            <td key={i} className="px-2 py-1">
                              {typeof val === 'number' ? val.toFixed(2) : val}
                            </td>
                          ))}
                          <td className="px-2 py-1 font-bold">{stat.avgViability.toFixed(2)}</td>
                          <td className="px-2 py-1 font-bold">{stat.stdDev.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
DoseResponseCurve.displayName = 'DoseResponseCurve';
