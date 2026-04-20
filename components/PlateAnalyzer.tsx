import React, { useState, useRef, useEffect, useMemo, useCallback, useImperativeHandle, forwardRef } from 'react';
import type { Point, GridConfig, InhibitorData, WellAddress } from '../types';
import { ResetIcon, CheckIcon, CancelIcon, PlusCircleIcon, TrashIcon, LockIcon, UnlockIcon } from './icons';


type Step = 
  | 'selectTopLeft' 
  | 'selectTopRight' 
  | 'selectBottomLeft' 
  | 'assignWells';

export interface PlateAnalyzerRef {
  handleInternalBack: () => boolean;
}

interface PlateAnalyzerProps {
  imageFile: File;
  onAnalysisComplete: (
    gridConfig: GridConfig,
    rowCount: number,
    colCount: number,
    inhibitors: InhibitorData[],
    imageDataUrl?: string
  ) => void;
  onCancel: () => void;
}

interface InhibitorSetup {
  id: number;
  name: string;
  concentrationUnits: string;
  concentrations: { id: number; value: string }[];
}


export const PlateAnalyzer = forwardRef<PlateAnalyzerRef, PlateAnalyzerProps>(({ imageFile, onAnalysisComplete, onCancel }, ref) => {
  const [originalImageUrl, setOriginalImageUrl] = useState<string>('');
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null);
  const [rotatedImageUrl, setRotatedImageUrl] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('selectTopLeft');

  const [isCroppingEnabled, setIsCroppingEnabled] = useState(false);
  const [isApplyingCrop, setIsApplyingCrop] = useState(false);
  const [cropRect, setCropRect] = useState<{ start: Point; end: Point } | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // All points are now stored as relative coordinates (0-1)
  const [topLeftPoint, setTopLeftPoint] = useState<Point | null>(null);
  const [topRightPoint, setTopRightPoint] = useState<Point | null>(null);
  const [bottomLeftPoint, setBottomLeftPoint] = useState<Point | null>(null);
  const [hasSnapped, setHasSnapped] = useState(false);

  useImperativeHandle(ref, () => ({
    handleInternalBack: () => {
      // Use internal step state
      if (step === 'selectTopRight') {
        setStep('selectTopLeft');
        setTopLeftPoint(null);
        return true;
      }
      if (step === 'selectBottomLeft') {
        setStep('selectTopRight');
        setTopRightPoint(null);
        return true;
      }
      if (step === 'assignWells') {
        setStep('selectBottomLeft');
        setBottomLeftPoint(null);
        setHasSnapped(false);
        return true;
      }
      return false; // Can't go back further internally
    }
  }));

  const [rowCount, setRowCount] = useState(8);
  const [colCount, setColCount] = useState(12);

  // Simplified to single inhibitor
  const [inhibitor, setInhibitor] = useState<InhibitorSetup>({
    id: 0,
    name: 'Inhibitor',
    concentrationUnits: 'nM',
    concentrations: [],
  });

  const [isDrugInfoLocked, setIsDrugInfoLocked] = useState(false);
  const [wellAssignments, setWellAssignments] = useState<Map<string, WellAddress[]>>(new Map());
  const [activeAssignmentKey, setActiveAssignmentKey] = useState<string | null>(null);
  
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartPointRef = useRef<Point | null>(null);
  const wasDraggedRef = useRef(false);

  // Refs for high-performance drag rendering
  const cropRectRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastMoveEventRef = useRef<React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement> | null>(null);

  const [imageRenderInfo, setImageRenderInfo] = useState<{ width: number; height: number; x: number; y: number } | null>(null);

  const displayImageUrl = useMemo(() => croppedImageUrl || rotatedImageUrl || originalImageUrl, [croppedImageUrl, rotatedImageUrl, originalImageUrl]);
  
  const gridConfig = useMemo((): GridConfig | null => {
    if (!topLeftPoint || !topRightPoint || !bottomLeftPoint || colCount <= 1 || rowCount <= 1) return null;
    return {
        origin: topLeftPoint,
        u: { x: (topRightPoint.x - topLeftPoint.x) / (colCount - 1), y: (topRightPoint.y - topLeftPoint.y) / (colCount - 1) },
        v: { x: (bottomLeftPoint.x - topLeftPoint.x) / (rowCount - 1), y: (bottomLeftPoint.y - topLeftPoint.y) / (rowCount - 1) }
    };
  }, [rowCount, colCount, topLeftPoint, topRightPoint, bottomLeftPoint]);

  const handleResetPoints = useCallback(() => {
    setCroppedImageUrl(null);
    setRotatedImageUrl(null);
    setIsCroppingEnabled(false);
    setCropRect(null);
    setTopLeftPoint(null);
    setTopRightPoint(null);
    setBottomLeftPoint(null);
    setWellAssignments(new Map());
    setStep('selectTopLeft');
    setHasSnapped(false);
  }, []);

  const calculateImageRenderInfo = useCallback(() => {
    if (!imageRef.current) {
        setImageRenderInfo(null);
        return;
    }
    const image = imageRef.current;
    const { naturalWidth, naturalHeight, offsetWidth, offsetHeight } = image;
    if (naturalWidth === 0 || offsetWidth === 0) return;

    const naturalRatio = naturalWidth / naturalHeight;
    const elementRatio = offsetWidth / offsetHeight;

    let renderedWidth, renderedHeight, x, y;

    if (naturalRatio > elementRatio) {
        renderedWidth = offsetWidth;
        renderedHeight = offsetWidth / naturalRatio;
        x = 0;
        y = (offsetHeight - renderedHeight) / 2;
    } else {
        renderedWidth = offsetHeight * naturalRatio;
        renderedHeight = offsetHeight;
        x = (offsetWidth - renderedWidth) / 2;
        y = 0;
    }
    setImageRenderInfo({ width: renderedWidth, height: renderedHeight, x, y });
  }, []);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;

    const handleLoad = () => {
        calculateImageRenderInfo();
        // Removed handleResetPoints() here to prevent state reset on re-mount when navigating back
    };

    if (image.complete) {
      handleLoad();
    }
    image.addEventListener('load', handleLoad);

    const resizeObserver = new ResizeObserver(calculateImageRenderInfo);
    resizeObserver.observe(image);

    return () => {
        image.removeEventListener('load', handleLoad);
        resizeObserver.disconnect();
    };
  }, [displayImageUrl, calculateImageRenderInfo, handleResetPoints]);

  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setOriginalImageUrl(url);
      // Removed handleResetPoints() here to prevent state reset when navigating back
      return () => URL.revokeObjectURL(url);
    }
  }, [imageFile, handleResetPoints]);

  useEffect(() => {
    if (step === 'assignWells' && gridConfig && !hasSnapped) {
        const { origin: O, u: U, v: V } = gridConfig;
        const snappedP1 = { x: O.x, y: O.y };
        const snappedP2 = { x: O.x + (colCount - 1) * U.x, y: O.y + (colCount - 1) * U.y };
        const snappedP3 = { x: O.x + (rowCount - 1) * V.x, y: O.y + (rowCount - 1) * V.y };
        
        setHasSnapped(true);
        setTopLeftPoint(snappedP1);
        setTopRightPoint(snappedP2);
        setBottomLeftPoint(snappedP3);
    }
  }, [step, gridConfig, hasSnapped, colCount, rowCount]);
  
  const handleRotate = (angleDelta: number) => {
    const sourceUrl = displayImageUrl;
    if (!sourceUrl || isRotating) return;
    setIsRotating(true);
    handleResetPoints();
    const image = new Image();
    image.crossOrigin = "Anonymous";
    image.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { setIsRotating(false); return; }
        const { width: w, height: h } = image;
        const angleRad = angleDelta * Math.PI / 180;
        const absCos = Math.abs(Math.cos(angleRad));
        const absSin = Math.abs(Math.sin(angleRad));
        const newWidth = w * absCos + h * absSin;
        const newHeight = w * absSin + h * absCos;
        canvas.width = newWidth;
        canvas.height = newHeight;
        ctx.translate(newWidth / 2, newHeight / 2);
        ctx.rotate(angleRad);
        ctx.drawImage(image, -w / 2, -h / 2);
        setCroppedImageUrl(null);
        setRotatedImageUrl(canvas.toDataURL(imageFile.type));
        setIsRotating(false);
    };
    image.onerror = () => { setIsRotating(false); alert("Failed to load image for rotation."); }
    image.src = sourceUrl;
  };

  const getPointFromEvent = useCallback((e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>): Point | null => {
    if (!imageRenderInfo) return null;

    const containerRect = containerRef.current!.getBoundingClientRect();
    const touch = 'touches' in e ? e.touches[0] : null;
    const clientX = touch ? touch.clientX : (e as React.MouseEvent).clientX;
    const clientY = touch ? touch.clientY : (e as React.MouseEvent).clientY;
    if (typeof clientX === 'undefined' || typeof clientY === 'undefined') return null;

    const clickX_container = clientX - containerRect.left;
    const clickY_container = clientY - containerRect.top;

    const { x: offsetX, y: offsetY, width, height } = imageRenderInfo;

    if (clickX_container < offsetX || clickX_container > offsetX + width || clickY_container < offsetY || clickY_container > offsetY + height) {
      return null;
    }
    
    return { x: (clickX_container - offsetX) / width, y: (clickY_container - offsetY) / height };
  }, [imageRenderInfo]);

  const handleConfirmCrop = async () => {
    if (!cropRect || !imageRef.current || !imageRenderInfo) return;
    setIsApplyingCrop(true);
    const image = new Image();
    image.crossOrigin = "Anonymous";
    image.onload = () => {
        const { naturalWidth, naturalHeight } = image;
        const normCropRect = {
            x: Math.min(cropRect.start.x, cropRect.end.x) * naturalWidth,
            y: Math.min(cropRect.start.y, cropRect.end.y) * naturalHeight,
            width: Math.abs(cropRect.end.x - cropRect.start.x) * naturalWidth,
            height: Math.abs(cropRect.end.y - cropRect.start.y) * naturalHeight,
        };
        const canvas = document.createElement('canvas');
        canvas.width = normCropRect.width;
        canvas.height = normCropRect.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { setIsApplyingCrop(false); return; }
        ctx.drawImage(image, normCropRect.x, normCropRect.y, normCropRect.width, normCropRect.height, 0, 0, normCropRect.width, normCropRect.height);
        setCroppedImageUrl(canvas.toDataURL(imageFile.type));
        setRotatedImageUrl(null);
        setIsCroppingEnabled(false);
        setCropRect(null);
        handleResetPoints();
        setIsApplyingCrop(false);
    };
    image.onerror = () => { setIsApplyingCrop(false); alert('Failed to load image for cropping.'); }
    image.src = displayImageUrl;
  };

  const getWellAddressFromPoint = useCallback((point: Point): WellAddress | null => {
    if (!gridConfig || !imageRenderInfo) return null;
    const { width, height } = imageRenderInfo;

    const gridConfig_px = {
      origin: { x: gridConfig.origin.x * width, y: gridConfig.origin.y * height },
      u: { x: gridConfig.u.x * width, y: gridConfig.u.y * height },
      v: { x: gridConfig.v.x * width, y: gridConfig.v.y * height },
    };
    const point_px = { x: point.x * width, y: point.y * height };

    const { origin: O, u: U, v: V } = gridConfig_px;
    const det = U.x * V.y - V.x * U.y;
    if (Math.abs(det) < 1e-6) return null;
    const dP = { x: point_px.x - O.x, y: point_px.y - O.y };
    const col = (dP.x * V.y - V.x * dP.y) / det;
    const row = (U.x * dP.y - dP.x * U.y) / det;
    const colIdx = Math.round(col);
    const rowIdx = Math.round(row);
    if (colIdx < 0 || colIdx >= colCount || rowIdx < 0 || rowIdx >= rowCount) return null;
    const center = { x: O.x + colIdx * U.x + rowIdx * V.x, y: O.y + colIdx * U.y + rowIdx * V.y };
    const dist = Math.hypot(point_px.x - center.x, point_px.y - center.y);
    const u_mag = Math.hypot(U.x, U.y);
    const v_mag = Math.hypot(V.x, V.y);
    const radius = Math.min(u_mag, v_mag) * 0.20;
    return dist <= radius ? { row: rowIdx, col: colIdx } : null;
  }, [gridConfig, colCount, rowCount, imageRenderInfo]);

  const handleWellClick = useCallback((point: Point) => {
    if (step !== 'assignWells' || !activeAssignmentKey) return;
    const wellAddress = getWellAddressFromPoint(point);
    if (!wellAddress) return;

    setWellAssignments(prev => {
        const newAssignments = new Map<string, WellAddress[]>(prev);
        for (const [key, wells] of newAssignments.entries()) {
            const filteredWells = wells.filter(w => w.row !== wellAddress.row || w.col !== wellAddress.col);
            if (filteredWells.length < wells.length) {
                newAssignments.set(key, filteredWells);
            }
        }
        const currentWells = newAssignments.get(activeAssignmentKey) || [];
        newAssignments.set(activeAssignmentKey, [...currentWells, wellAddress]);
        return newAssignments;
    });
  }, [step, activeAssignmentKey, getWellAddressFromPoint]);

  const handleTap = useCallback((coords: Point) => {
    if (isCroppingEnabled || step === 'assignWells') {
        if (step === 'assignWells') handleWellClick(coords);
        return;
    }

    switch (step) {
        case 'selectTopLeft':
            setTopLeftPoint(coords);
            setStep('selectTopRight');
            break;
        case 'selectTopRight':
            setTopRightPoint(coords);
            setStep('selectBottomLeft');
            break;
        case 'selectBottomLeft':
            setBottomLeftPoint(coords);
            setStep('assignWells');
            break;
    }
  }, [isCroppingEnabled, step, handleWellClick]);
  
  const dragLoop = useCallback(() => {
    if (!isDragging) {
      if(animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      return;
    }

    const startPoint = dragStartPointRef.current;
    const lastEvent = lastMoveEventRef.current;

    if (startPoint && lastEvent) {
      const currentPoint = getPointFromEvent(lastEvent);
      if (currentPoint) {
        if (imageRenderInfo) {
          const dx = Math.abs(currentPoint.x - startPoint.x) * imageRenderInfo.width;
          const dy = Math.abs(currentPoint.y - startPoint.y) * imageRenderInfo.height;
          if (dx > 5 || dy > 5) {
            wasDraggedRef.current = true;
          }
        }

        const rectToUpdate = isCroppingEnabled ? cropRectRef.current : null;
        
        if (rectToUpdate) {
          const left = Math.min(startPoint.x, currentPoint.x) * 100;
          const top = Math.min(startPoint.y, currentPoint.y) * 100;
          const width = Math.abs(currentPoint.x - startPoint.x) * 100;
          const height = Math.abs(currentPoint.y - startPoint.y) * 100;

          rectToUpdate.style.transform = `translate(${left}%, ${top}%)`;
          rectToUpdate.style.width = `${width}%`;
          rectToUpdate.style.height = `${height}%`;
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(dragLoop);
  }, [isDragging, getPointFromEvent, isCroppingEnabled, imageRenderInfo]);


  const onDragStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (isDragging) return;
    if ('touches' in e) e.stopPropagation();
    const point = getPointFromEvent(e);
    if (!point) return;

    wasDraggedRef.current = false;
    dragStartPointRef.current = point;
    lastMoveEventRef.current = e;
    setIsDragging(true);
    
    const rectToUpdate = isCroppingEnabled ? cropRectRef.current : null;

    if (rectToUpdate) {
        rectToUpdate.style.display = 'block';
        const left = point.x * 100;
        const top = point.y * 100;
        rectToUpdate.style.transform = `translate(${left}%, ${top}%)`;
        rectToUpdate.style.width = `0%`;
        rectToUpdate.style.height = `0%`;
    }
    
    animationFrameRef.current = requestAnimationFrame(dragLoop);
  };

  const onDragMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if ('touches' in e) { e.preventDefault(); e.stopPropagation(); }
    if (isDragging) {
      lastMoveEventRef.current = e;
    }
  };
  
  const onDragEnd = () => {
    if (!isDragging) return;
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
    }

    const startPoint = dragStartPointRef.current;
    const lastEvent = lastMoveEventRef.current;
    const endPoint = lastEvent ? getPointFromEvent(lastEvent) : null;
    const wasActuallyDragged = wasDraggedRef.current;
    
    setIsDragging(false);

    if (cropRectRef.current) cropRectRef.current.style.display = 'none';

    if (wasActuallyDragged && startPoint && endPoint) {
      if (isCroppingEnabled) {
        setCropRect({ start: startPoint, end: endPoint });
      }
    } else {
      if (dragStartPointRef.current) {
        handleTap(dragStartPointRef.current);
      }
      if (isCroppingEnabled) setCropRect(null);
    }
    
    dragStartPointRef.current = null;
    lastMoveEventRef.current = null;
  };
  
  const onMouseLeave = () => { 
    if (isDragging) onDragEnd(); 
  };
  
  const handleAnalyze = () => {
    if (!gridConfig || !imageRef.current) return;

    const posKey = `inhibitor-${inhibitor.id}-positive`;
    const negKey = `inhibitor-${inhibitor.id}-negative`;
    
    const positiveWells = wellAssignments.get(posKey) || [];
    const negativeWells = wellAssignments.get(negKey) || [];
    const hasConcentrations = inhibitor.concentrations.some(c => (wellAssignments.get(`inhibitor-${inhibitor.id}-conc-${c.value}`) || []).length > 0);

    if (hasConcentrations && (positiveWells.length === 0 || negativeWells.length === 0)) {
      alert("Each analysis must have at least one Untreated and one Blank control well assigned.");
      return;
    }

    const concentrationWellMap: Record<string, WellAddress[]> = {};
    let hasAssignedConcentrations = false;
    inhibitor.concentrations.forEach(c => {
      const key = `inhibitor-${inhibitor.id}-conc-${c.value}`;
      const wells = wellAssignments.get(key);
      if (wells && wells.length > 0 && c.value.trim()) {
        concentrationWellMap[c.value] = wells;
        hasAssignedConcentrations = true;
      }
    });

    if (!hasAssignedConcentrations) {
      alert("Please assign wells to at least one concentration.");
      return;
    }

    const inhibitorToAnalyze: InhibitorData = {
      name: inhibitor.name,
      concentrationUnits: inhibitor.concentrationUnits,
      positiveControlWells: positiveWells,
      negativeControlWells: negativeWells,
      concentrationWellMap,
      stats: [], 
    };
    
    const { naturalWidth, naturalHeight } = imageRef.current;
    const absoluteGridConfig: GridConfig = {
      origin: { x: gridConfig.origin.x * naturalWidth, y: gridConfig.origin.y * naturalHeight },
      u: { x: gridConfig.u.x * naturalWidth, y: gridConfig.u.y * naturalHeight },
      v: { x: gridConfig.v.x * naturalWidth, y: gridConfig.v.y * naturalHeight }
    };

    const wasImageModified = !!(croppedImageUrl || rotatedImageUrl);
    const analysisDataUrl = wasImageModified ? displayImageUrl : undefined;

    onAnalysisComplete(
      absoluteGridConfig,
      rowCount,
      colCount,
      [inhibitorToAnalyze], // Wrapped in array for processor compatibility
      analysisDataUrl
    );
  };
  
  const getPointMarker = (point: Point | null, label: string) => {
    if (!point) return null;
    return (
      <div className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}>
        <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-[--color-point-border] shadow-lg"></div>
        <span className="absolute -top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 text-xs bg-black bg-opacity-60 text-white rounded">{label}</span>
      </div>
    );
  };

  const updateInhibitor = (field: 'name' | 'concentrationUnits', value: string) => {
      setInhibitor(prev => ({ ...prev, [field]: value }));
  };
  
  const addConcentration = () => {
    setInhibitor(prev => {
        const nextId = (prev.concentrations[prev.concentrations.length - 1]?.id ?? -1) + 1;
        return { ...prev, concentrations: [...prev.concentrations, { id: nextId, value: '' }] };
    });
  };

  const updateConcentration = (concId: number, value: string) => {
    setInhibitor(prev => ({
        ...prev,
        concentrations: prev.concentrations.map(c => c.id === concId ? { ...c, value } : c)
    }));
  };

  const removeConcentration = (concId: number, concValue: string) => {
    if (concValue) {
        const key = `inhibitor-${inhibitor.id}-conc-${concValue}`;
        setWellAssignments(prev => {
            const newAssignments = new Map(prev);
            newAssignments.delete(key);
            return newAssignments;
        });
    }
    setInhibitor(prev => ({
        ...prev,
        concentrations: prev.concentrations.filter(c => c.id !== concId)
    }));
  };
  
  const renderCurrentStep = () => {
    if (step === 'assignWells') return <p>Assign wells to controls and concentrations.</p>;

    switch (step) {
        case 'selectTopLeft': return <p><b>Click</b> the center of the <b>top-left</b> well (A1).</p>;
        case 'selectTopRight': return <p><b>Click</b> the center of the <b>top-right</b> well (e.g., A12).</p>;
        case 'selectBottomLeft': return <p><b>Click</b> the center of the <b>bottom-left</b> well (e.g., H1).</p>;
    }
    return null;
  };
  
  const isGridDefined = !!gridConfig;

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-[600px]">
      <div className="flex-1 flex flex-col items-center">
        <div className="w-full mb-2">
            <h2 className="text-xl font-bold">Grid Definition</h2>
        </div>
        <div className="w-full p-2 mb-2 text-center bg-[--color-background-tertiary] rounded-lg">
            <div className="text-sm font-semibold">{renderCurrentStep()}</div>
        </div>
        <div className="w-full relative">
          <div
            ref={containerRef}
            className="relative inline-block cursor-crosshair"
            onMouseDown={onDragStart}
            onMouseMove={onDragMove}
            onMouseUp={onDragEnd}
            onMouseLeave={onMouseLeave}
            onTouchStart={onDragStart}
            onTouchMove={onDragMove}
            onTouchEnd={onDragEnd}
          >
            {displayImageUrl ? (
              <img
                ref={imageRef}
                src={displayImageUrl}
                alt="Well Plate"
                className="block w-full object-contain"
                style={{
                    imageRendering: 'high-quality',
                    ...((isApplyingCrop || isRotating) && { filter: 'blur(4px) brightness(0.8)' })
                } as unknown as React.CSSProperties}
              />
            ) : (
              <div className="w-full h-64 bg-gray-200 flex items-center justify-center">Loading...</div>
            )}

            {imageRenderInfo && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: imageRenderInfo.x,
                  top: imageRenderInfo.y,
                  width: imageRenderInfo.width,
                  height: imageRenderInfo.height,
                }}
              >
                 <div
                  ref={cropRectRef}
                  className="absolute"
                  style={{
                    display: 'none',
                    border: '2px dashed #007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.2)',
                    top: 0,
                    left: 0,
                  }}
                />

                {gridConfig && step === 'assignWells' && (
                    <svg width="100%" height="100%" className="overflow-visible">
                      {Array.from({ length: rowCount }).flatMap((_, r) =>
                        Array.from({ length: colCount }).map((_, c) => {
                          const { x: ux_rel, y: uy_rel } = gridConfig.u;
                          const { x: vx_rel, y: vy_rel } = gridConfig.v;

                          const ux_px = ux_rel * imageRenderInfo.width;
                          const uy_px = uy_rel * imageRenderInfo.height;
                          const vx_px = vx_rel * imageRenderInfo.width;
                          const vy_px = vy_rel * imageRenderInfo.height;
                          
                          const radius_px = Math.min(Math.hypot(ux_px, uy_px), Math.hypot(vx_px, vy_px)) * 0.20;

                          const cx_rel = gridConfig.origin.x + c * ux_rel + r * vx_rel;
                          const cy_rel = gridConfig.origin.y + c * uy_rel + r * vy_rel;
                          
                          let wellColor = 'rgba(255, 255, 255, 0.3)';
                          let strokeColor = '#3B82F6';
                          
                          const assignedKey = [...wellAssignments.entries()].find(([_, wells]) => wells.some(w => w.row === r && w.col === c))?.[0];

                          if (assignedKey?.endsWith('-positive')) strokeColor = '#10B981';
                          else if (assignedKey?.endsWith('-negative')) strokeColor = '#EF4444';
                          else if (assignedKey?.startsWith('inhibitor-') && assignedKey.includes('-conc-')) strokeColor = '#F59E0B';
                          
                          const isActive = assignedKey === activeAssignmentKey;
                          const isConcentration = assignedKey?.startsWith('inhibitor-') && assignedKey.includes('-conc-');
                          let concentrationText: string | null = null;
                          if (isConcentration) {
                            const parts = assignedKey.split('-conc-');
                            const concentrationValue = parts[1];
                            if (concentrationValue) {
                                concentrationText = `${concentrationValue} ${inhibitor.concentrationUnits}`;
                            }
                          }

                          return (
                            <g key={`${r}-${c}`}>
                              <circle cx={`${cx_rel * 100}%`} cy={`${cy_rel * 100}%`} r={radius_px} fill={isActive ? 'rgba(255, 255, 0, 0.4)' : wellColor} stroke={strokeColor} strokeWidth={isActive ? 3 : 1.5} strokeDasharray={assignedKey ? '' : '3 3'} />
                              {concentrationText && (
                                <text
                                  x={`${cx_rel * 100}%`}
                                  y={`${cy_rel * 100}%`}
                                  textAnchor="middle"
                                  dominantBaseline="central"
                                  fontSize={radius_px * 0.4}
                                  fill="var(--color-text-primary)"
                                  className="pointer-events-none font-sans font-semibold"
                                >
                                  {concentrationText}
                                </text>
                              )}
                            </g>
                          );
                        })
                      )}
                    </svg>
                )}
                
                {getPointMarker(topLeftPoint, 'A1')}
                {getPointMarker(topRightPoint, `A${colCount}`)}
                {getPointMarker(bottomLeftPoint, `${String.fromCharCode(65 + rowCount - 1)}1`)}
              </div>
            )}
          </div>
          {isCroppingEnabled && cropRect && (
            <div className="absolute bottom-2 right-2 flex gap-2">
                <button onClick={handleConfirmCrop} disabled={isApplyingCrop} className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded shadow hover:bg-green-600 disabled:bg-green-300"><CheckIcon className="w-4 h-4" />Confirm</button>
                <button onClick={() => { setIsCroppingEnabled(false); setCropRect(null); }} className="flex items-center gap-1 px-3 py-1 bg-red-500 text-white rounded shadow hover:bg-red-600"><CancelIcon className="w-4 h-4" />Cancel</button>
            </div>
          )}
        </div>
         <div className="w-full flex justify-end items-center mt-2 p-2 bg-[--color-background-tertiary] rounded-b-lg">
            <button onClick={handleResetPoints} title="Reset Grid" className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-[--color-button-secondary-bg] rounded-lg hover:bg-[--color-button-secondary-hover-bg] transition-colors"><ResetIcon className="w-4 h-4" />Reset Grid</button>
        </div>
      </div>

      <div className="w-full lg:w-96 flex flex-col gap-4 border-l border-[--color-border-secondary] pl-0 lg:pl-6">
        {/* Step 1: Plate Dimensions */}
        <div className="p-4 border rounded-lg bg-[--color-background-secondary] shadow-sm">
            <h3 className="font-bold mb-2">1. Plate Dimensions</h3>
            <div className="flex gap-4">
                <label className="flex-1 text-sm text-[--color-text-muted]">Rows: <input type="number" value={rowCount} onChange={e => setRowCount(parseInt(e.target.value, 10) || 0)} min="1" className="w-full mt-1 p-2 border rounded bg-[--color-input-background] border-[--color-input-border] text-[--color-text-primary]" /></label>
                <label className="flex-1 text-sm text-[--color-text-muted]">Cols: <input type="number" value={colCount} onChange={e => setColCount(parseInt(e.target.value, 10) || 0)} min="1" className="w-full mt-1 p-2 border rounded bg-[--color-input-background] border-[--color-input-border] text-[--color-text-primary]" /></label>
            </div>
        </div>
        
        {/* Step 2: Experiment Setup */}
        <div className={`p-4 border rounded-lg bg-[--color-background-secondary] shadow-sm transition-opacity ${!isGridDefined ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold">2. Experiment Setup</h3>
              <button
                onClick={() => setIsDrugInfoLocked(!isDrugInfoLocked)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border ${
                  isDrugInfoLocked
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-700'
                    : 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-400 dark:border-yellow-700'
                }`}
              >
                {isDrugInfoLocked ? <LockIcon className="w-3.5 h-3.5" /> : <UnlockIcon className="w-3.5 h-3.5" />}
                <span>{isDrugInfoLocked ? 'Unlock' : 'Lock'}</span>
              </button>
            </div>
            <div className="p-3 border-2 rounded-lg border-[--color-accent-secondary] bg-[--color-background-accent]">
                <div className="space-y-2">
                    <input 
                      type="text" 
                      placeholder="Inhibitor Name" 
                      value={inhibitor.name} 
                      onChange={e => updateInhibitor('name', e.target.value)} 
                      disabled={isDrugInfoLocked} 
                      className="w-full p-1.5 text-sm border rounded bg-[--color-input-background] border-[--color-input-border]" 
                    />
                    <select 
                      value={inhibitor.concentrationUnits} 
                      onChange={e => updateInhibitor('concentrationUnits', e.target.value)} 
                      disabled={isDrugInfoLocked} 
                      className="w-full p-1.5 text-sm border rounded bg-[--color-input-background] border-[--color-input-border]"
                    >
                      <option value="nM">nM</option>
                      <option value="µM">µM</option>
                      <option value="mM">mM</option>
                    </select>
                </div>
            </div>
        </div>

        {/* Step 3: Well Assignment */}
        <div className={`p-4 border rounded-lg bg-[--color-background-secondary] shadow-sm flex-1 flex flex-col transition-opacity ${(isGridDefined && isDrugInfoLocked) ? '' : 'opacity-50 pointer-events-none'}`}>
          <h3 className="font-bold mb-3 text-sm">3. Well Assignments for <span className="text-[--color-accent-secondary]">{inhibitor.name || 'Inhibitor'}</span></h3>
          
          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            <div className="space-y-2">
                {(() => {
                    const posKey = `inhibitor-${inhibitor.id}-positive`;
                    const negKey = `inhibitor-${inhibitor.id}-negative`;
                    return (
                        <>
                        <div className={`p-2.5 rounded-lg border-2 flex justify-between items-center transition-all ${activeAssignmentKey === posKey ? 'border-green-500 bg-green-500/5 shadow-inner' : 'border-transparent bg-[--color-background-tertiary]'}`}>
                            <div>
                                <div className="text-xs font-bold text-green-600 dark:text-green-400"> Untreated</div>
                                <div className="text-[10px] text-[--color-text-muted]">
                                    {(wellAssignments.get(posKey)?.length || 0) === 0 ? 'Assign minimum 3 wells' : `${wellAssignments.get(posKey)?.length} wells assigned`}
                                </div>
                            </div>
                            <button onClick={() => setActiveAssignmentKey(posKey)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${activeAssignmentKey === posKey ? 'bg-green-500 text-white' : 'bg-[--color-button-secondary-bg] text-[--color-button-secondary-text] hover:bg-green-100'}`}>Select</button>
                        </div>

                        <div className={`p-2.5 rounded-lg border-2 flex justify-between items-center transition-all ${activeAssignmentKey === negKey ? 'border-red-500 bg-red-500/5 shadow-inner' : 'border-transparent bg-[--color-background-tertiary]'}`}>
                            <div>
                                <div className="text-xs font-bold text-red-600 dark:text-red-400">Blank</div>
                                <div className="text-[10px] text-[--color-text-muted]">
                                    {(wellAssignments.get(negKey)?.length || 0) === 0 ? 'Assign minimum 3 wells' : `${wellAssignments.get(negKey)?.length} wells assigned`}
                                </div>
                            </div>
                            <button onClick={() => setActiveAssignmentKey(negKey)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${activeAssignmentKey === negKey ? 'bg-red-500 text-white' : 'bg-[--color-button-secondary-bg] text-[--color-button-secondary-text] hover:bg-red-100'}`}>Select</button>
                        </div>
                        </>
                    );
                })()}
            </div>

            <div className="relative py-2">
                <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-[--color-border-secondary]"></div></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-[--color-background-secondary] px-2 text-[--color-text-muted] font-bold tracking-wider">Concentrations</span></div>
            </div>

            <div className="space-y-2">
                {inhibitor.concentrations.map((conc) => {
                    const key = `inhibitor-${inhibitor.id}-conc-${conc.value}`;
                    return (
                        <div key={conc.id} className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all ${activeAssignmentKey === key ? 'border-orange-500 bg-orange-500/5 shadow-inner' : 'border-transparent bg-[--color-background-tertiary]'}`}>
                            <div className="flex-1 flex items-center gap-2" onClick={() => conc.value && setActiveAssignmentKey(key)}>
                                <input type="number" placeholder="Val" value={conc.value} onChange={e => updateConcentration(conc.id, e.target.value)} className="w-16 p-1.5 text-xs border rounded bg-[--color-input-background] border-[--color-input-border]" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold">{inhibitor.concentrationUnits}</span>
                                    <span className="text-[9px] text-[--color-text-muted]">{wellAssignments.get(key)?.length || 0} wells</span>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => conc.value && setActiveAssignmentKey(key)} className={`p-1.5 text-xs font-bold rounded transition-colors ${activeAssignmentKey === key ? 'bg-orange-500 text-white' : 'text-orange-600 hover:bg-orange-100'}`}><PlusCircleIcon className="w-4 h-4" /></button>
                                <button onClick={() => removeConcentration(conc.id, conc.value)} className="text-[--color-text-muted] hover:text-red-500 p-1.5"><TrashIcon className="w-4 h-4" /></button>
                            </div>
                        </div>
                    );
                })}
                <button onClick={addConcentration} className="w-full flex items-center justify-center gap-1.5 p-2 text-xs text-[--color-accent-secondary] hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-lg transition-colors font-bold"><PlusCircleIcon className="w-4 h-4" /> New Level</button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 pt-4 mt-auto">
          <button onClick={onCancel} className="flex-1 px-4 py-3 bg-[--color-button-secondary-bg] text-[--color-button-secondary-text] font-bold rounded-xl shadow-sm hover:bg-[--color-button-secondary-hover-bg] transition-colors">Cancel</button>
          <button onClick={handleAnalyze} disabled={!isGridDefined || !isDrugInfoLocked} className="flex-1 px-4 py-3 bg-[--color-accent-primary] text-[--color-accent-primary-text] font-bold rounded-xl shadow-lg hover:bg-[--color-accent-primary-hover] transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]">Run Analysis</button>
        </div>
      </div>
    </div>
  );
});