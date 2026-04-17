import React, { useState, useMemo } from 'react';
import type { InhibitorData, ManualLabDataPoint, ConcentrationStats } from '../types';
import { PlusCircleIcon, TrashIcon, MinusCircleIcon } from './icons';
// FIX: Using static import for calculateIC50 as it is now correctly exported from the service.
import { calculateIC50 } from '../services/wellPlateProcessor';

interface ManualEntryWorkflowProps {
  onComplete: (inhibitors: InhibitorData[]) => void;
  onCancel: () => void;
}

interface ManualRow {
    id: number;
    concentration: string;
    replicates: string[];
}

export const ManualEntryWorkflow: React.FC<ManualEntryWorkflowProps> = ({ onComplete, onCancel }) => {
    const [name, setName] = useState('Manual Analysis');
    const [units, setUnits] = useState('nM');
    const [rows, setRows] = useState<ManualRow[]>([
        { id: 0, concentration: '', replicates: ['', '', ''] }
    ]);
    const [nextId, setNextId] = useState(1);

    const addRow = () => {
        setRows(prev => [...prev, { id: nextId, concentration: '', replicates: Array(prev[0]?.replicates.length || 3).fill('') }]);
        setNextId(prev => prev + 1);
    };

    const removeRow = (id: number) => {
        if (rows.length <= 1) return;
        setRows(prev => prev.filter(r => r.id !== id));
    };

    const updateRowConc = (id: number, val: string) => {
        setRows(prev => prev.map(r => r.id === id ? { ...r, concentration: val } : r));
    };

    const updateRowRep = (rowId: number, repIdx: number, val: string) => {
        setRows(prev => prev.map(r => {
            if (r.id === rowId) {
                const newReps = [...r.replicates];
                newReps[repIdx] = val;
                return { ...r, replicates: newReps };
            }
            return r;
        }));
    };

    const addRepSlot = () => {
        setRows(prev => prev.map(r => ({ ...r, replicates: [...r.replicates, ''] })));
    };

    const removeRepSlot = () => {
        setRows(prev => {
            if (prev[0].replicates.length <= 1) return prev;
            return prev.map(r => ({ ...r, replicates: r.replicates.slice(0, -1) }));
        });
    };

    const calculateRowStats = (replicates: string[]) => {
        const vals = replicates.map(r => parseFloat(r)).filter(n => !isNaN(n));
        if (vals.length === 0) return { avg: 0, stdDev: 0, count: 0 };
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        let stdDev = 0;
        if (vals.length > 1) {
            const sumSq = vals.reduce((a, b) => a + Math.pow(b - avg, 2), 0);
            stdDev = Math.sqrt(sumSq / (vals.length - 1));
        }
        return { avg, stdDev, count: vals.length };
    };

    const handleSubmit = () => {
        const stats: ConcentrationStats[] = rows
            .map(row => {
                const conc = parseFloat(row.concentration);
                if (isNaN(conc)) return null;
                const { avg, stdDev, count } = calculateRowStats(row.replicates);
                return {
                    concentration: conc,
                    replicateViabilities: row.replicates.map(r => parseFloat(r)).filter(n => !isNaN(n)),
                    avgViability: avg,
                    stdDev: stdDev,
                    stdErr: count > 1 ? stdDev / Math.sqrt(count) : 0,
                    replicateCount: count
                };
            })
            .filter((s): s is ConcentrationStats => s !== null)
            .sort((a, b) => a.concentration - b.concentration);

        if (stats.length < 2) {
            alert("Please enter at least two data points with valid concentrations.");
            return;
        }

        const inhibitorBase: InhibitorData = {
            name: name,
            concentrationUnits: units,
            positiveControlWells: [],
            negativeControlWells: [],
            concentrationWellMap: {},
            stats: stats
        };

        // FIX: Removed the incorrect dynamic import and utilized the statically imported calculateIC50 function.
        const ic50 = calculateIC50(inhibitorBase, stats);
        onComplete([{ ...inhibitorBase, ic50 }]);
    };

    const maxReps = rows[0]?.replicates.length || 0;

    return (
        <div className="max-w-5xl mx-auto py-4">
            <h2 className="text-2xl font-bold mb-6 text-center">Manual IC₅₀ Entry Workflow</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 p-6 bg-[--color-background-tertiary] rounded-xl border border-[--color-border-secondary]">
                <div>
                    <label className="block text-sm font-bold mb-2">Inhibitor / Compound Name</label>
                    <input 
                        type="text" 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        className="w-full p-2 border rounded bg-[--color-input-background] border-[--color-input-border]"
                        placeholder="e.g. Staurosporine"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold mb-2">Concentration Units</label>
                    <select 
                        value={units} 
                        onChange={e => setUnits(e.target.value)} 
                        className="w-full p-2 border rounded bg-[--color-input-background] border-[--color-input-border]"
                    >
                        <option value="nM">nM</option>
                        <option value="µM">µM</option>
                        <option value="mM">mM</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[--color-border-secondary] mb-6">
                <table className="w-full text-sm text-center">
                    <thead className="bg-[--color-table-header-bg] text-[--color-table-header-text] uppercase text-xs">
                        <tr>
                            <th className="px-4 py-3">Concentration ({units})</th>
                            {Array.from({ length: maxReps }).map((_, i) => (
                                <th key={i} className="px-4 py-3">Rep {i + 1} (%)</th>
                            ))}
                            <th className="px-4 py-3">Avg (%)</th>
                            <th className="px-4 py-3">
                                <div className="flex items-center justify-center gap-2">
                                    <button onClick={addRepSlot} className="text-emerald-600 hover:text-emerald-700 p-1" title="Add Replicate Column"><PlusCircleIcon className="w-5 h-5" /></button>
                                    <button onClick={removeRepSlot} className="text-red-500 hover:text-red-600 p-1" title="Remove Replicate Column"><MinusCircleIcon className="w-5 h-5" /></button>
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[--color-border-secondary]">
                        {rows.map((row) => {
                            const stats = calculateRowStats(row.replicates);
                            return (
                                <tr key={row.id} className="bg-[--color-background-secondary] hover:bg-[--color-table-row-hover-bg]">
                                    <td className="px-4 py-2">
                                        <input 
                                            type="number" 
                                            value={row.concentration} 
                                            onChange={e => updateRowConc(row.id, e.target.value)}
                                            className="w-24 p-1.5 border rounded text-center bg-[--color-input-background] border-[--color-input-border]"
                                            placeholder="Conc"
                                        />
                                    </td>
                                    {row.replicates.map((rep, idx) => (
                                        <td key={idx} className="px-4 py-2">
                                            <input 
                                                type="number" 
                                                value={rep} 
                                                onChange={e => updateRowRep(row.id, idx, e.target.value)}
                                                className="w-20 p-1.5 border rounded text-center bg-[--color-input-background] border-[--color-input-border]"
                                                placeholder="%"
                                            />
                                        </td>
                                    ))}
                                    <td className="px-4 py-2 font-bold text-[--color-accent-primary]">
                                        {stats.avg > 0 ? stats.avg.toFixed(1) + '%' : '-'}
                                    </td>
                                    <td className="px-4 py-2">
                                        <button onClick={() => removeRow(row.id)} className="text-red-500 hover:text-red-600 p-1"><TrashIcon className="w-5 h-5" /></button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-between items-center mb-12">
                <button onClick={addRow} className="flex items-center gap-2 px-4 py-2 bg-[--color-button-secondary-bg] text-[--color-button-secondary-text] font-semibold rounded-lg hover:bg-[--color-button-secondary-hover-bg] transition-colors shadow-sm">
                    <PlusCircleIcon className="w-5 h-5" /> Add Data Point
                </button>
                <div className="flex gap-4">
                    <button onClick={onCancel} className="px-6 py-2 bg-[--color-button-secondary-bg] text-[--color-button-secondary-text] font-bold rounded-lg hover:bg-[--color-button-secondary-hover-bg]">Cancel</button>
                    <button onClick={handleSubmit} className="px-8 py-2 bg-[--color-accent-primary] text-white font-bold rounded-lg hover:bg-[--color-accent-primary-hover] shadow-lg shadow-blue-500/20">Generate Results</button>
                </div>
            </div>
        </div>
    );
};
