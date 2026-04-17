import React from 'react';
import { motion } from 'motion/react';

interface MethodInstructionsProps {
  method: 'dic50' | 'manual';
  onProceed: () => void;
}

export const MethodInstructions: React.FC<MethodInstructionsProps> = ({ method, onProceed }) => {
  const content = {
    dic50: {
      title: 'Image Analysis Guidelines',
      steps: [
        {
          title: 'IMAGE CAPTURE',
          description: 'Prepare a standard 96-well plate photograph with minimal skew, minimal glare, and even lighting on a flat white surface.',
        },
        {
          title: 'PLATE UPLOAD',
          description: 'Click the button below to upload your standard 96-well plate image.',
        },
        {
          title: 'GRID CALIBRATION',
          description: 'Use interactive anchoring: Place and drag grid points into the exact centers of wells A1 (top-left), A12 (top-right), and H1 (bottom-left).',
        },
        {
          title: 'PARAMETER LOCK',
          description: 'Specify inhibitor compound, concentration units, and list all your tested concentration levels to activate the analysis engine.',
        },
        {
          title: 'WELL ASSIGNMENT',
          description: 'Use direct well selection on the image to map controls (0%, 100% viability) and well replicates for each concentration.',
        },
      ],
      buttonText: 'Proceed to Upload Image →',
    },
    manual: {
      title: 'Manual Data Entry Guidelines',
      steps: [
        {
          title: 'DATA PREPARATION',
          description: 'Gather your pre-calculated experimental concentration values and corresponding cell viability percentages from your lab records.',
        },
        {
          title: 'PARAMETER SETUP',
          description: 'Specify your inhibitor compound names and select the appropriate concentration units (e.g., µM, nM) to initialize the workspace.',
        },
        {
          title: 'DATA ENTRY',
          description: 'Input your specific concentration levels and manually type the viability percentages for each replicate directly into the data table.',
        },
        {
          title: 'CURVE GENERATION',
          description: 'The application will instantly process your inputs to plot a deterministic dose-response curve and calculate the exact IC50 value.',
        },
        {
          title: 'REVIEW & EXPORT',
          description: 'Verify your data integrity on the interactive graph and export the detailed analytical report for your records.',
        },
      ],
      buttonText: 'Proceed to Data Entry →',
    },
  };

  const activeContent = content[method];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 px-4 max-w-2xl mx-auto"
    >
      <div className="bg-[--color-background-secondary] border border-[--color-border-secondary] rounded-2xl p-8 shadow-xl w-full">
        <h2 className="text-3xl font-black uppercase tracking-tight text-[--color-text-primary] mb-8 border-b border-[--color-border-secondary] pb-4">
          {activeContent.title}
        </h2>
        
        <div className="space-y-6 mb-10">
          {activeContent.steps.map((step, index) => (
            <div key={index} className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">
                <span className="text-sm font-black text-[--color-text-muted] tracking-tighter w-6 inline-block">{index + 1}.</span>
              </div>
              <p className="text-[--color-text-secondary] text-base leading-relaxed">
                <span className="font-black uppercase tracking-tight mr-1.5 text-[--color-text-primary]">{step.title}:</span>
                {step.description}
              </p>
            </div>
          ))}
        </div>

        <button
          onClick={onProceed}
          className="w-full py-4 bg-[--color-accent-primary] text-[--color-accent-primary-text] rounded-xl font-black uppercase tracking-widest text-sm shadow-lg hover:bg-[--color-accent-primary-hover] hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 group"
        >
          {activeContent.buttonText}
        </button>
      </div>
      
      <p className="mt-8 text-[10px] uppercase tracking-widest font-bold text-[--color-text-muted] opacity-60">
        Review instructions carefully before proceeding
      </p>
    </motion.div>
  );
};
