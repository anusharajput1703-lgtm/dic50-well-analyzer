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

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-[101] pointer-events-none p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[--color-background-secondary] w-full max-w-4xl rounded-2xl shadow-2xl pointer-events-auto overflow-hidden flex flex-col max-h-[90vh]"
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
                    <p className="text-xs uppercase tracking-widest font-bold text-[--color-text-muted]">
                      How to use the analyzer
                    </p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="p-2 text-[--color-text-muted] hover:text-[--color-text-primary] hover:bg-[--color-background-tertiary] rounded-xl transition-all"
                >
                  <XIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">

                {/* 🎥 VIDEO */}
                <div>
                  <div className="relative aspect-video w-full bg-black rounded-xl overflow-hidden shadow-lg">
                    <iframe
                      src="https://www.youtube.com/embed/qu5QfjivY2w"
                      title="dIC50 Tutorial"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full"
                    />
                  </div>

                  <p className="text-center text-sm text-[--color-text-muted] mt-2">
                    Watch this video to understand how to use the analyzer.
                  </p>
                </div>

                {/* 📄 PDF VIEW */}
                <div>
                  <h3 className="font-black uppercase text-[--color-text-primary] mb-3">
                    User Guide (Preview)
                  </h3>

                  <div className="w-full h-[70vh] border rounded-xl overflow-hidden">
                    <iframe
                      src="/manual.pdf"
                      className="w-full h-full"
                      title="User Guide PDF"
                    />
                  </div>
                </div>

                {/* 📥 DOWNLOAD BUTTON */}
                <div className="flex justify-center">
                  <a
                    href="/manual.pdf"
                    download
                    className="flex items-center gap-2 px-6 py-3 bg-[--color-accent-primary] text-white rounded-xl font-bold hover:scale-105 transition"
                  >
                    <DownloadIcon className="w-5 h-5" />
                    Download PDF
                  </a>
                </div>

              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
