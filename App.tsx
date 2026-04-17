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
import { SunIcon, MoonIcon, PlateGridIcon, ArrowLeftIcon, QuestionMarkCircleIcon } from './components/icons';
import { HelpModal } from './components/HelpModal';

type AppState = 'welcome' | 'choice' | 'instructions' | 'uploading' | 'manual-entry' | 'analyzing' | 'processing' | 'results' | 'error';

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
  const [gridDimensions, setGridDimensions] = useState<{ rows: number, cols: number }>({ rows: 0, cols: 0 });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedTheme = window.localStorage.getItem('theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
      }
      if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    }
    return 'dark';
  });

  useEffect(() => {
    window.localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  };

  const handleImageUpload = useCallback((file: File) => {
    setImageFile(file);
    const newImageUrl = URL.createObjectURL(file);
    setImageUrl(newImageUrl);
    setProcessedImageUrl(newImageUrl);
    setAppState('analyzing');
  }, []);

  const handleManualComplete = useCallback((manualInhibitors: InhibitorData[]) => {
    setInhibitors(manualInhibitors);
    setResults([]);
    setProcessedImageUrl('');
    setGridConfig(null);
    setGridDimensions({ rows: 0, cols: 0 });
    setAppState('results');
  }, []);

  const handleAnalysisComplete = useCallback(async (
    newGridConfig: GridConfig,
    rowCount: number,
    colCount: number,
    newInhibitors: InhibitorData[],
    imageDataUrl?: string
  ) => {
    const analysisImageUrl = imageDataUrl || imageUrl;

    if (!analysisImageUrl) {
        setError("Analysis failed: Processed image data is missing.");
        setAppState('error');
        return;
    }
    
    setProcessedImageUrl(analysisImageUrl);
    setGridConfig(newGridConfig);
    setGridDimensions({ rows: rowCount, cols: colCount });
    setAppState('processing');

    try {
      const { wellResults, inhibitorsWithResults } = await processWellPlate(
        analysisImageUrl,
        newGridConfig,
        rowCount,
        colCount,
        newInhibitors
      );
      setResults(wellResults);
      setInhibitors(inhibitorsWithResults);
      setAppState('results');
    } catch (e) {
      console.error("Analysis failed:", e);
      const errorMessage = e instanceof Error ? e.message : "Analysis failed. Please try again.";
      setError(errorMessage);
      setAppState('error');
    }
  }, [imageUrl]);
  
  useEffect(() => {
    if (appState === 'analyzing') setVisitedAnalyze(true);
    if (appState === 'manual-entry') setVisitedManual(true);
  }, [appState]);

  const handleReset = useCallback(() => {
    setAppState('choice');
    setImageFile(null);
    if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
    }
    setImageUrl('');
    setProcessedImageUrl('');
    setResults([]);
    setInhibitors([]);
    setError('');
    setGridConfig(null);
    setGridDimensions({ rows: 0, cols: 0 });
    setVisitedAnalyze(false);
    setVisitedManual(false);
  }, [imageUrl]);

  const handleBack = useCallback(() => {
    switch (appState) {
      case 'choice':
        setAppState('welcome');
        break;
      case 'instructions':
        setAppState('choice');
        break;
      case 'uploading':
      case 'manual-entry':
        setAppState('choice');
        break;
      case 'analyzing':
        if (analyzerRef.current?.handleInternalBack()) {
          return;
        }
        setAppState('uploading');
        break;
      case 'results':
        if (processedImageUrl) {
          setAppState('analyzing');
        } else {
          setAppState('manual-entry');
        }
        break;
      case 'error':
        setAppState('choice');
        break;
      default:
        break;
    }
  }, [appState, processedImageUrl]);
  
  const renderContent = () => {
    return (
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
            onProceed={() => {
              if (selectedMethod === 'dic50') setAppState('uploading');
              else setAppState('manual-entry');
            }} 
          />
        )}
        
        {appState === 'uploading' && <ImageUploader onImageUpload={handleImageUpload} />}
        
        {visitedManual && (
          <div className={appState === 'manual-entry' ? '' : 'hidden'}>
            <ManualEntryWorkflow onComplete={handleManualComplete} onCancel={handleReset} />
          </div>
        )}
        
        {visitedAnalyze && imageFile && (
          <div className={appState === 'analyzing' ? '' : 'hidden'}>
            <PlateAnalyzer ref={analyzerRef} imageFile={imageFile} onAnalysisComplete={handleAnalysisComplete} onCancel={handleReset} />
          </div>
        )}
        
        {appState === 'processing' && (
          <div className="flex flex-col items-center justify-center p-8">
            <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-[--color-accent-primary]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-4 text-lg font-semibold text-[--color-text-primary]">Analyzing plate, please wait...</p>
          </div>
        )}
        
        {appState === 'results' && (
          <ResultsDisplay 
            results={results} 
            inhibitors={inhibitors}
            imageUrl={processedImageUrl} 
            gridConfig={gridConfig || undefined as any} 
            rowCount={gridDimensions.rows}
            colCount={gridDimensions.cols}
            onReset={handleReset} 
          />
        )}
        
        {appState === 'error' && (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <h2 className="text-2xl font-bold text-red-600">An Error Occurred</h2>
            <p className="text-red-500 mt-2">{error}</p>
            <button onClick={handleReset} className="mt-6 px-4 py-2 bg-[--color-accent-primary] text-[--color-accent-primary-text] font-semibold rounded-lg shadow-md hover:bg-[--color-accent-primary-hover] transition-colors">
              Try Again
            </button>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen font-sans bg-[--color-background-primary] text-[--color-text-primary] transition-colors duration-300">
      <header className="bg-[--color-background-secondary] shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {appState !== 'welcome' && (
              <button
                onClick={handleBack}
                className="mr-2 p-2 text-[--color-text-secondary] bg-[--color-background-tertiary] rounded-xl hover:bg-[--color-background-tertiary-hover] transition-all flex items-center gap-1 group"
                aria-label="Go back"
              >
                <ArrowLeftIcon className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                <span className="hidden sm:inline uppercase tracking-widest text-[10px] font-bold">Back</span>
              </button>
            )}
            <div className="w-10 h-10 bg-[--color-accent-primary] rounded-xl flex items-center justify-center text-white shadow-lg">
                <PlateGridIcon className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black leading-tight tracking-tight uppercase">96-well plate</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsHelpOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-[--color-text-secondary] bg-[--color-background-tertiary] rounded-xl hover:bg-[--color-background-tertiary-hover] transition-all"
              aria-label="Open Help"
            >
              <QuestionMarkCircleIcon className="w-5 h-5" />
              <span className="hidden sm:inline uppercase tracking-widest text-[10px]">Help</span>
            </button>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-[--color-text-secondary] bg-[--color-background-tertiary] rounded-xl hover:bg-[--color-background-tertiary-hover] transition-all"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
              <span className="hidden sm:inline uppercase tracking-widest text-[10px]">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-[--color-background-secondary] shadow-2xl rounded-2xl p-4 sm:p-6 md:p-8 overflow-hidden min-h-[70vh]">
            {renderContent()}
          </div>
        </div>
      </main>
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <footer className="text-center py-8 text-[10px] text-[--color-text-muted] font-bold uppercase tracking-widest opacity-60">
      </footer>
    </div>
  );
}

export default App;