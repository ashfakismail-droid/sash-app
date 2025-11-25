import React, { useState, useRef, useEffect } from 'react';
import { TemperatureReadings } from './types';
import { drawOverlayOnBitmap, canvasToBlob, processImageFromFile } from './utils/overlayUtils';
import { saveReading } from './services/database';
import HistoryGallery from './components/HistoryGallery';
import ImageCropper from './components/ImageCropper';

const App: React.FC = () => {
  // State for file input
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  // Display State
  // We use the first file as the primary preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{width: number, height: number} | null>(null);
  const [fontScale, setFontScale] = useState<number>(1.0);
  
  // Cropping State
  const [isCropping, setIsCropping] = useState(false);
  const [originalFileUrl, setOriginalFileUrl] = useState<string | null>(null);

  // State for readings
  const [readings, setReadings] = useState<TemperatureReadings>({
    t1: '', t2: '', t3: '', t4: '', pt: ''
  });

  // State for processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [refreshHistory, setRefreshHistory] = useState(0);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Cleanup
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (originalFileUrl) URL.revokeObjectURL(originalFileUrl);
    };
  }, [previewUrl, originalFileUrl]);

  // Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setSelectedFiles(files);
      
      // Setup preview for the first file
      const firstFile = files[0];
      const url = URL.createObjectURL(firstFile as Blob);
      setOriginalFileUrl(url);
      setPreviewUrl(url);
      
      // Reset crop state
      setIsCropping(false); 
      
      // Reset form if it was empty, but maybe keep readings if user is just changing photos
      // Let's reset for fresh start
      if (selectedFiles.length === 0) {
        setReadings({ t1: '', t2: '', t3: '', t4: '', pt: '' });
        setFontScale(1.0);
      }
    }
    // Reset input so same file can be selected again if needed
    e.target.value = '';
  };

  const handleCropComplete = (blob: Blob) => {
    const croppedUrl = URL.createObjectURL(blob);
    setPreviewUrl(croppedUrl);
    setIsCropping(false);
    // Note: In batch mode with 1 file, this works. 
    // If we support crop, we usually assume single file mode.
  };

  const handleCropCancel = () => {
    setIsCropping(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setReadings(prev => ({ ...prev, [name]: value }));
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  };

  const handleApplyAndSave = async () => {
    if (selectedFiles.length === 0) return;
    
    setIsProcessing(true);
    try {
      // BATCH MODE > 1
      if (selectedFiles.length > 1) {
        let savedCount = 0;
        
        for (const file of selectedFiles) {
           // Process off-screen
           const { processed } = await processImageFromFile(file, readings, fontScale);
           await saveReading(readings, file, processed);
           savedCount++;
        }
        
        setRefreshHistory(prev => prev + 1);
        alert(`Success! processed ${savedCount} images.\nThey have been saved to your History below.`);
        
        // We do NOT auto-download in batch to avoid browser popup blockers.
      } 
      // SINGLE MODE (Supports Cropping)
      else {
        if (!imageRef.current || !canvasRef.current) return;

        // Draw to canvas with font scaling (uses current preview, which might be cropped)
        drawOverlayOnBitmap(canvasRef.current, imageRef.current, readings, fontScale);

        // Convert to blob (JPEG)
        const processedBlob = await canvasToBlob(canvasRef.current);
        
        // Save to IndexedDB
        await saveReading(readings, selectedFiles[0], processedBlob);

        // Trigger auto-download
        const url = URL.createObjectURL(processedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sash_overlay_${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setRefreshHistory(prev => prev + 1);
        alert("Image processed and saved!");
      }

    } catch (error) {
      console.error("Error processing image:", error);
      alert("Failed to process image(s).");
    } finally {
      setIsProcessing(false);
    }
  };

  const canSave = selectedFiles.length > 0 && 
    readings.t1.trim() !== '' &&
    readings.t2.trim() !== '' &&
    readings.t3.trim() !== '' &&
    readings.t4.trim() !== '';

  return (
    <div className="min-h-screen pb-12 bg-slate-50">
      {/* Cropper Modal */}
      {isCropping && originalFileUrl && selectedFiles.length === 1 && (
        <ImageCropper 
          imageSrc={originalFileUrl} 
          onCrop={handleCropComplete} 
          onCancel={handleCropCancel} 
        />
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Custom Icon Placeholder */}
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white">
              {/* If you have a real icon URL, put it here. Using a generic SASH-style icon for now */}
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                 <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                 <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
               </svg>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900">SASH</h1>
          </div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest hidden sm:block">
            Experiment Overlay
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Left Column: Inputs */}
          <div className="space-y-6">
            
            {/* 1. Pick Photo Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold">1</span>
                Select Images
              </h2>
              
              <label className="block w-full cursor-pointer group">
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple
                  onChange={handleFileChange} 
                  className="hidden" 
                />
                <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${selectedFiles.length > 0 ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 group-hover:border-indigo-300 group-hover:bg-gray-50'}`}>
                  {selectedFiles.length > 0 ? (
                    <div className="text-indigo-700 font-medium">
                      <div className="text-3xl mb-2">📸</div>
                      {selectedFiles.length} image{selectedFiles.length > 1 ? 's' : ''} selected
                      <span className="block text-xs text-indigo-400 mt-2 font-normal">Tap to change selection</span>
                    </div>
                  ) : (
                    <div className="text-gray-500 group-hover:text-indigo-500 transition-colors">
                      <span className="block text-3xl mb-2 text-gray-400 group-hover:text-indigo-400">🖼️</span>
                      <span className="font-semibold">Tap to select photos</span>
                      <span className="block text-xs mt-1 text-gray-400">Supports selecting multiple files</span>
                    </div>
                  )}
                </div>
              </label>
            </div>

            {/* 2. Enter Data Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold">2</span>
                Readings
              </h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                {(['t1', 't2', 't3', 't4'] as const).map((key) => (
                  <div key={key}>
                    <label className="block text-[10px] font-bold tracking-wider text-gray-500 uppercase mb-1">{key.toUpperCase()}</label>
                    <div className="relative">
                      <input
                        type="number"
                        name={key}
                        value={readings[key]}
                        onChange={handleInputChange}
                        placeholder="0.0"
                        className="block w-full rounded-lg border-gray-300 bg-gray-50 border focus:bg-white focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 transition-colors"
                      />
                      <span className="absolute right-3 top-2.5 text-gray-400 text-sm">°C</span>
                    </div>
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold tracking-wider text-indigo-500 uppercase mb-1">
                    Plate Temperature (P.T) <span className="text-gray-400 font-normal normal-case">(Optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="pt"
                      value={readings.pt}
                      onChange={handleInputChange}
                      placeholder="Optional"
                      className="block w-full rounded-lg border-indigo-200 bg-indigo-50 border focus:bg-white focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2.5 transition-colors font-semibold text-indigo-900 placeholder:font-normal placeholder:text-gray-400"
                    />
                    <span className="absolute right-3 top-2.5 text-indigo-400 text-sm">°C</span>
                  </div>
                </div>
              </div>

              {/* Font Size Slider */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-medium text-gray-500 uppercase">Text Size</label>
                  <span className="text-xs font-bold text-gray-700">{Math.round(fontScale * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0.5" 
                  max="2.0" 
                  step="0.1" 
                  value={fontScale} 
                  onChange={(e) => setFontScale(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={handleApplyAndSave}
              disabled={!canSave || isProcessing}
              className={`w-full py-4 px-6 rounded-xl font-bold text-lg shadow-lg transform transition-all active:scale-95 flex items-center justify-center gap-2 ${
                canSave 
                  ? 'bg-gray-900 text-white hover:bg-black hover:shadow-xl' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
              }`}
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                selectedFiles.length > 1 ? `Apply to ${selectedFiles.length} Images` : 'Apply Overlay'
              )}
            </button>
            {selectedFiles.length > 1 && (
               <p className="text-center text-xs text-gray-400">Batch processed images will be saved to History.</p>
            )}
          </div>

          {/* Right Column: Preview */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
               Preview
               {imageDimensions && selectedFiles.length === 1 && <span className="text-xs font-normal text-gray-400 ml-auto bg-gray-100 px-2 py-1 rounded">{imageDimensions.width}x{imageDimensions.height}px</span>}
            </h2>
            
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-200 aspect-[3/4] relative flex items-center justify-center group">
              {previewUrl ? (
                <>
                  <div className="absolute inset-0 bg-[url('https://bg.site-shot.com/transparency.png')] opacity-10"></div>
                  <img 
                    ref={imageRef}
                    src={previewUrl} 
                    alt="Preview" 
                    className="max-w-full max-h-full object-contain relative z-0"
                    onLoad={handleImageLoad}
                  />
                  {/* Visual Guide for Overlay Position */}
                  <div className="absolute top-4 left-4 pointer-events-none transition-transform duration-200 z-10" style={{ transform: `scale(${fontScale})`, transformOrigin: 'top left' }}>
                    <div className="bg-black/60 backdrop-blur-sm rounded-lg p-3 border border-white/20 shadow-lg">
                      <div className="space-y-1">
                        <div className="w-16 h-3 bg-white/20 rounded"></div>
                        <div className="w-20 h-3 bg-white/20 rounded"></div>
                        <div className="w-14 h-3 bg-white/20 rounded"></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Crop option - Only for single file */}
                  {selectedFiles.length === 1 && (
                    <button 
                      onClick={() => setIsCropping(true)}
                      className="absolute bottom-4 right-4 bg-white/90 text-gray-900 px-3 py-1.5 rounded-lg text-sm font-medium shadow-lg hover:bg-white transition-colors flex items-center gap-2 z-20 backdrop-blur-md"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Crop
                    </button>
                  )}
                </>
              ) : (
                <div className="text-gray-300 text-center p-8">
                  <div className="mb-2 text-5xl opacity-20">📷</div>
                  <p className="text-sm font-medium opacity-50">Select images to preview</p>
                </div>
              )}
            </div>

            {/* Thumbnail Strip for Multi-select */}
            {selectedFiles.length > 1 && (
               <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                 {Array.from(selectedFiles).map((file, idx) => (
                   <div key={idx} className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-gray-200 relative">
                      {/* We don't load all blobs for performance, just use index as visual cue or if we want real thumbs we need CreateObjectURL for all (expensive) */}
                      {/* For simplicity in this demo, we'll just show the first few real thumbs if possible, or just generic boxes */}
                      {idx === 0 ? (
                        <img src={previewUrl || ''} className="w-full h-full object-cover" />
                      ) : (
                         <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-gray-400 font-bold">
                           {idx + 1}
                         </div>
                      )}
                   </div>
                 ))}
               </div>
            )}

            {/* Hidden Canvas for Single Processing */}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>

        {/* History Section */}
        <div className="border-t border-gray-200 pt-10">
          <h2 className="text-2xl font-black text-gray-900 mb-6 tracking-tight">Gallery</h2>
          <HistoryGallery refreshTrigger={refreshHistory} />
        </div>

      </main>
    </div>
  );
};

export default App;