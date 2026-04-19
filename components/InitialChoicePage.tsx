import React from 'react';
import { UploadIcon, PlusCircleIcon } from './icons';

interface InitialChoicePageProps {
  onSelectAI: () => void;
  onSelectManual: () => void;
}

export const InitialChoicePage: React.FC<InitialChoicePageProps> = ({ onSelectAI, onSelectManual }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 max-w-4xl mx-auto">
      <h2 className="text-3xl font-extrabold text-[--color-text-primary] mb-4 text-center">
        Choose Your Analysis Method
      </h2>
      <p className="text-[--color-text-muted] mb-12 text-center text-lg max-w-xl">
        Select whether you'd like to perform automated IC₅₀ analysis from an image or directly enter your lab data.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
        {/* Card: AI Image Analysis */}
        <button
          onClick={onSelectAI}
          className="group relative flex flex-col items-center p-8 bg-[--color-background-secondary] border-2 border-[--color-border-secondary] rounded-2xl shadow-lg hover:border-[--color-accent-primary] hover:shadow-2xl transition-all text-center focus:outline-none focus:ring-4 focus:ring-blue-500/20"
        >
          <div className="w-16 h-16 bg-[--color-background-accent] rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <UploadIcon className="w-8 h-8 text-[--color-accent-primary]" />
          </div>
          <h3 className="text-2xl font-bold text-[--color-text-primary] mb-3">dIC₅₀</h3>
          <p className="text-[--color-text-muted] leading-relaxed">
            Upload a photo of your 96-well plate. Our AI will automatically quantify cell viability based on color intensity.
          </p>
          <div className="mt-8 px-6 py-2 bg-[--color-accent-primary] text-white rounded-lg font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
            Upload Image
          </div>
        </button>

        {/* Card: Manual Entry */}
        <button
          onClick={onSelectManual}
          className="group relative flex flex-col items-center p-8 bg-[--color-background-secondary] border-2 border-[--color-border-secondary] rounded-2xl shadow-lg hover:border-[--color-accent-primary] hover:shadow-2xl transition-all text-center focus:outline-none focus:ring-4 focus:ring-blue-500/20"
        >
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <PlusCircleIcon className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-2xl font-bold text-[--color-text-primary] mb-3">Manual IC₅₀ Entry</h3>
          <p className="text-[--color-text-muted] leading-relaxed">
            Bypass image processing. Manually enter your measured concentrations and viability percentages to generate a dose-response curve.
          </p>
          <div className="mt-8 px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
            Enter Data
          </div>
        </button>  
      </div>
    </div>
  );
};
