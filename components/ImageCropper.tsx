import React, { useRef, useState, useEffect } from 'react';

interface ImageCropperProps {
  imageSrc: string;
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ imageSrc, onCrop, onCancel }) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Crop selection in percentages (0-100)
  // Default to full size (100%)
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 100, h: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [startCrop, setStartCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [action, setAction] = useState<'move' | 'nw' | 'ne' | 'sw' | 'se' | null>(null);

  // Handle pointer events for drag/resize
  const handlePointerDown = (e: React.PointerEvent, act: typeof action) => {
    e.preventDefault();
    if (!containerRef.current) return;
    
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setStartCrop({ ...crop });
    setAction(act);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current || !action) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const deltaX = ((e.clientX - dragStart.x) / containerRect.width) * 100;
    const deltaY = ((e.clientY - dragStart.y) / containerRect.height) * 100;
    
    let newCrop = { ...startCrop };

    if (action === 'move') {
      newCrop.x = Math.max(0, Math.min(100 - newCrop.w, startCrop.x + deltaX));
      newCrop.y = Math.max(0, Math.min(100 - newCrop.h, startCrop.y + deltaY));
    } else {
      // Basic resize logic (simplified aspect)
      if (action.includes('e')) newCrop.w = Math.max(10, Math.min(100 - startCrop.x, startCrop.w + deltaX));
      if (action.includes('s')) newCrop.h = Math.max(10, Math.min(100 - startCrop.y, startCrop.h + deltaY));
      if (action.includes('w')) {
          const maxDelta = startCrop.w - 10;
          const validDelta = Math.min(maxDelta, deltaX); // Can't shrink below 10
          newCrop.x = Math.max(0, startCrop.x + validDelta);
          newCrop.w = startCrop.w - validDelta;
      }
      if (action.includes('n')) {
          const maxDelta = startCrop.h - 10;
          const validDelta = Math.min(maxDelta, deltaY);
          newCrop.y = Math.max(0, startCrop.y + validDelta);
          newCrop.h = startCrop.h - validDelta;
      }
    }
    setCrop(newCrop);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    setAction(null);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const performCrop = () => {
    if (!imageRef.current) return;
    
    const canvas = document.createElement('canvas');
    const img = imageRef.current;
    
    // Calculate actual pixel coordinates
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    
    const pixelX = (crop.x / 100) * naturalW;
    const pixelY = (crop.y / 100) * naturalH;
    const pixelW = (crop.w / 100) * naturalW;
    const pixelH = (crop.h / 100) * naturalH;
    
    canvas.width = pixelW;
    canvas.height = pixelH;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, pixelX, pixelY, pixelW, pixelH, 0, 0, pixelW, pixelH);
      
      // Export as JPEG with 0.92 quality to compress file size while keeping visual quality
      canvas.toBlob((blob) => {
        if (blob) onCrop(blob);
      }, 'image/jpeg', 0.92);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex justify-between items-center p-4 bg-gray-900 text-white">
        <h3 className="font-bold text-lg">Crop Image</h3>
        <div className="flex gap-4">
           <button onClick={onCancel} className="text-gray-400 hover:text-white">Cancel</button>
           <button onClick={performCrop} className="bg-indigo-600 px-4 py-1.5 rounded-lg hover:bg-indigo-500 font-medium">Done</button>
        </div>
      </div>
      
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4 bg-black/90 touch-none select-none">
         <div ref={containerRef} className="relative max-w-full max-h-full inline-block shadow-2xl">
            <img 
              ref={imageRef} 
              src={imageSrc} 
              className="max-w-full max-h-[80vh] block object-contain pointer-events-none select-none"
              alt="Crop Source"
              onDragStart={(e) => e.preventDefault()}
            />
            
            {/* Dark Overlay Outside Selection */}
            {/* Top */}
            <div className="absolute top-0 left-0 right-0 bg-black/60" style={{ height: `${crop.y}%` }} />
            {/* Bottom */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/60" style={{ height: `${100 - (crop.y + crop.h)}%` }} />
            {/* Left */}
            <div className="absolute left-0 bg-black/60" style={{ top: `${crop.y}%`, height: `${crop.h}%`, width: `${crop.x}%` }} />
            {/* Right */}
            <div className="absolute right-0 bg-black/60" style={{ top: `${crop.y}%`, height: `${crop.h}%`, width: `${100 - (crop.x + crop.w)}%` }} />

            {/* Selection Box */}
            <div 
              className="absolute border-2 border-white box-border cursor-move"
              style={{
                left: `${crop.x}%`,
                top: `${crop.y}%`,
                width: `${crop.w}%`,
                height: `${crop.h}%`
              }}
              onPointerDown={(e) => handlePointerDown(e, 'move')}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              {/* Grid Lines */}
              <div className="absolute inset-0 flex flex-col pointer-events-none">
                <div className="flex-1 border-b border-white/30" />
                <div className="flex-1 border-b border-white/30" />
                <div className="flex-1" />
              </div>
              <div className="absolute inset-0 flex pointer-events-none">
                <div className="flex-1 border-r border-white/30" />
                <div className="flex-1 border-r border-white/30" />
                <div className="flex-1" />
              </div>

              {/* Resize Handles */}
              <div className="absolute -top-3 -left-3 w-6 h-6 border-t-4 border-l-4 border-white cursor-nw-resize pointer-events-auto" onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, 'nw'); }} />
              <div className="absolute -top-3 -right-3 w-6 h-6 border-t-4 border-r-4 border-white cursor-ne-resize pointer-events-auto" onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, 'ne'); }} />
              <div className="absolute -bottom-3 -left-3 w-6 h-6 border-b-4 border-l-4 border-white cursor-sw-resize pointer-events-auto" onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, 'sw'); }} />
              <div className="absolute -bottom-3 -right-3 w-6 h-6 border-b-4 border-r-4 border-white cursor-se-resize pointer-events-auto" onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, 'se'); }} />
            </div>
         </div>
      </div>
      
      <div className="p-4 bg-gray-900 text-center text-gray-400 text-sm">
        Drag corners to resize • Drag center to move
      </div>
    </div>
  );
};

export default ImageCropper;