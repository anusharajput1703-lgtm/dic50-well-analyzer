import React from 'react';

interface WelcomePageProps {
  onStart: () => void;
}

const Step: React.FC<{ number: number; title: string; children: React.ReactNode }> = ({ number, title, children }) => (
  <li className="flex">
    <span className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-[--color-accent-primary] text-white rounded-2xl font-black shadow-lg">
      {number}
    </span>
    <div className="ml-5">
      <h3 className="text-xl font-black tracking-tight uppercase text-[--color-text-primary]">{title}</h3>
      <div className="mt-2 text-[--color-text-muted] leading-relaxed">{children}</div>
    </div>
  </li>
);

export const WelcomePage: React.FC<WelcomePageProps> = ({ onStart }) => {
  return (
    <div className="flex flex-col items-center text-center p-4 sm:p-8 max-w-4xl mx-auto">
      <h2 className="text-4xl sm:text-6xl font-black text-[--color-text-primary] tracking-tighter leading-none mb-6">
        Rapid dIC50 calculation
      </h2>
      <p className="max-w-2xl text-lg text-[--color-text-muted] leading-relaxed">
        Our AI-driven platform extracts precise cell viability data from standard 96-well plate photograph in seconds.
      </p>

      <div className="mt-16 text-left w-full bg-[--color-background-tertiary]/30 p-8 rounded-3xl border border-[--color-border-secondary]">
        <ol className="space-y-10">
          <Step number={1} title="CHOOSE YOUR WORKFLOW">
            Select between dIC50 (AI image analysis) for automated visual quantification or manual IC50 calculation from experimental results.
          </Step>
        </ol>
      </div>

      <div className="mt-16 w-full flex flex-col items-center">
        <button
          onClick={onStart}
          className="group relative px-12 py-5 bg-[--color-accent-primary] text-white font-black rounded-2xl shadow-[0_10px_40px_-10px_var(--color-accent-primary)] hover:shadow-[0_20px_60px_-10px_var(--color-accent-primary)] focus:outline-none transition-all transform hover:scale-105 active:scale-95 uppercase tracking-widest text-lg"
        >
          Initialize Workspace
          <div className="absolute inset-0 rounded-2xl border-2 border-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </button>
      </div>
    </div>
  );
};