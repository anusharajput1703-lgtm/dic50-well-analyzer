import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { PlateAnalyzer, type PlateAnalyzerRef } from './components/PlateAnalyzer';
import { ResultsDisplay } from './components/ResultsDisplay';
import { InitialChoicePage } from './components/InitialChoicePage';
import { ManualEntryWorkflow } from './components/ManualEntryWorkflow';
import { MethodInstructions } from './components/MethodInstructions';
import { processWellPlate } from './services/wellPlateProcessor';
import type { WellResult, GridConfig, InhibitorData } from './types';
import { WelcomePage } from './components/WelcomePage';
import { SunIcon, MoonIcon, ArrowLeftIcon, QuestionMarkCircleIcon } from './components/icons';
import { HelpModal } from './components/HelpModal';

type AppState =
  | 'welcome'
  | 'choice'
  | 'instructions'
  | 'uploading'
  | 'manual-entry'
  | 'analyzing'
  | 'processing'
  | 'results'
  | 'error';

function App() {
  const [appState, setAppState] = useState<AppState>('welcome');
  const [selectedMethod, setSelectedMethod] = useState<'dic50' | 'manual' | null>(null);
  const analyzerRef = useRef<PlateAnalyzerRef>(null);
  const [visitedAnalyze, setVisitedAnalyze] = useState(false);
  const [visitedManual, setVisitedManual] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [processedImageUrl, setProcessedImageUrl] = useState<string>('');
  const [results, setResults] = useState<WellResult[]>([]);
  const [inhibitors, setInhibitors] = useState<InhibitorData[]>([]);
  const [error, setError] = useState<string>('');

  const [gridConfig, setGridConfig] = useState<GridConfig | null>(null);
  const [gridDimensions, setGridDimensions] = useState({ rows: 0, cols: 0 });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => {
    setTheme(p => (p === 'dark' ? 'light' : 'dark'));
  };

  const handleImageUpload = (file: File) => {
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setProcessedImageUrl(url);
    setAppState('analyzing');
  };

  const handleManualComplete = (data: InhibitorData[]) => {
    setInhibitors(data);
    setAppState('results');
  };

  const handleAnalysisComplete = async (
    config: GridConfig,
    rows: number,
    cols: number,
    inhibitorsData: InhibitorData[],
    imageDataUrl?: string
  ) => {
    const url = imageDataUrl || imageUrl;
    if (!url) return;

    setProcessedImageUrl(url);
    setGridConfig(config);
    setGridDimensions({ rows, cols });
    setAppState('processing');

    try {
      const { wellResults, inhibitorsWithResults } = await processWellPlate(
        url,
        config,
        rows,
        cols,
        inhibitorsData
      );
      setResults(wellResults);
      setInhibitors(inhibitorsWithResults);
      setAppState('results');
    } catch (e) {
      setError('Analysis failed');
      setAppState('error');
    }
  };

  useEffect(() => {
    if (appState === 'analyzing') setVisitedAnalyze(true);
    if (appState === 'manual-entry') setVisitedManual(true);
  }, [appState]);

  const handleReset = () => {
    setAppState('choice');
    setImageFile(null);
    setImageUrl('');
    setProcessedImageUrl('');
    setResults([]);
    setInhibitors([]);
    setGridConfig(null);
  };

  const handleBack = () => {
    if (appState === 'choice') setAppState('welcome');
    else if (appState === 'instructions') setAppState('choice');
    else if (appState === 'uploading' || appState === 'manual-entry') setAppState('choice');
    else if (appState === 'analyzing') setAppState('uploading');
    else if (appState === 'results') setAppState('choice');
  };

  const renderContent = () => (
    <>
      {appState === 'welcome' && <WelcomePage onStart={() => setAppState('choice')} />}

      {appState === 'choice' && (
        <InitialChoicePage
          onSelectAI={() => {
            setSelectedMethod('dic50');
            setAppState('instructions');
          }}
          onSelectManual={() => {
            setSelectedMethod('manual');
            setAppState('instructions');
          }}
        />
      )}

      {appState === 'instructions' && selectedMethod && (
        <MethodInstructions
          method={selectedMethod}
          onProceed={() =>
            setAppState(selectedMethod === 'dic50' ? 'uploading' : 'manual-entry')
          }
        />
      )}

      {appState === 'uploading' && <ImageUploader onImageUpload={handleImageUpload} />}

      {visitedManual && appState === 'manual-entry' && (
        <ManualEntryWorkflow onComplete={handleManualComplete} onCancel={handleReset} />
      )}

      {visitedAnalyze && imageFile && appState === 'analyzing' && (
        <PlateAnalyzer
          ref={analyzerRef}
          imageFile={imageFile}
          onAnalysisComplete={handleAnalysisComplete}
          onCancel={handleReset}
        />
      )}

      {appState === 'processing' && (
        <div className="flex flex-col items-center justify-center p-8">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
          <p className="mt-4">Analyzing...</p>
        </div>
      )}

      {appState === 'results' && (
        <ResultsDisplay
          results={results}
          inhibitors={inhibitors}
          imageUrl={processedImageUrl}
          gridConfig={gridConfig as any}
          rowCount={gridDimensions.rows}
          colCount={gridDimensions.cols}
          onReset={handleReset}
        />
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-[--color-background-primary] text-[--color-text-primary]">

      {/* HEADER */}
      <header className="bg-[--color-background-secondary] shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto py-4 px-4 flex justify-between items-center">

          {/* LEFT */}
          <div className="flex items-center gap-3">

            {appState !== 'welcome' && (
              <button
                onClick={handleBack}
                className="p-2 rounded-xl bg-[--color-background-tertiary] hover:bg-[--color-background-tertiary-hover]"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
            )}

            <img src="/logoic50.webp" alt="logo" className="w-10 h-10 object-contain" />

            <h1 className="text-xl font-black uppercase">
              96-Well Plate
            </h1>
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-2">

            <button
              onClick={() => setIsHelpOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-[--color-background-tertiary] rounded-xl"
            >
              <QuestionMarkCircleIcon className="w-5 h-5" />
              <span className="hidden sm:inline text-xs uppercase">Help</span>
            </button>

            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-3 py-2 bg-[--color-background-tertiary] rounded-xl"
            >
              {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
              <span className="hidden sm:inline text-xs uppercase">
                {theme === 'dark' ? 'Light' : 'Dark'}
              </span>
            </button>

          </div>

        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {renderContent()}
      </main>

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

    </div>
  );
}

export default App;