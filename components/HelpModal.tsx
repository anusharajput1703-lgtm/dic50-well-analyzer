import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { XIcon, DownloadIcon, InfoIcon } from './icons';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-[100] backdrop-blur-sm"
          />
          
          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center z-[101] pointer-events-none p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[--color-background-secondary] w-full max-w-2xl rounded-2xl shadow-2xl pointer-events-auto overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex justify-between items-center p-6 border-b border-[--color-border-secondary]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[--color-background-tertiary] rounded-lg">
                    <InfoIcon className="w-5 h-5 text-[--color-accent-primary]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight text-[--color-text-primary]">
                      Help & Tutorial
                    </h2>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-[--color-text-muted]">
                      Getting started guide
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-[--color-text-muted] hover:text-[--color-text-primary] hover:bg-[--color-background-tertiary] rounded-xl transition-all"
                  aria-label="Close help"
                >
                  <XIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto custom-scrollbar">
                {/* Video Player Section */}
                <div className="space-y-4">
                  <div className="relative aspect-video w-full bg-black rounded-xl overflow-hidden shadow-lg">
                    <iframe
                      src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                      title="Tutorial Video Placeholder"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full"
                    ></iframe>
                  </div>
                  <p className="text-center text-xs font-medium text-[--color-text-muted] italic">
                    (Tutorial video placeholder - will be updated before launch)
                  </p>
                </div>

                {/* PDF Download Section */}
                <div className="mt-8 pt-8 border-t border-[--color-border-secondary]">
                  <div className="bg-[--color-background-tertiary] p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6 hover:bg-[--color-background-tertiary-hover] transition-colors group">
                    <div className="text-center sm:text-left">
                      <h3 className="font-black uppercase tracking-tight text-[--color-text-primary]">
                        User Manual
                      </h3>
                      <p className="text-xs text-[--color-text-muted] mt-1">
                        Detailed instructions for image analysis and results interpretation.
                      </p>
                    </div>
                    <a
                      href="/dic50-user-guide.pdf"
                      download
                      className="flex items-center gap-3 px-6 py-3 bg-[--color-accent-primary] text-[--color-accent-primary-text] rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg hover:bg-[--color-accent-primary-hover] hover:shadow-xl transition-all active:scale-95 whitespace-nowrap"
                    >
                      <DownloadIcon className="w-4 h-4" />
                      Download User Guide (PDF)
                    </a>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 bg-[--color-background-tertiary] border-t border-[--color-border-secondary] flex justify-center">
                <button
                  onClick={onClose}
                  className="px-8 py-2 text-xs font-black uppercase tracking-widest text-[--color-text-muted] hover:text-[--color-text-primary] transition-colors"
                >
                  Close Help
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
