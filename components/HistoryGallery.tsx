import React, { useEffect, useState } from 'react';
import { ExperimentRecord } from '../types';
import { getAllReadings, deleteReading } from '../services/database';

interface HistoryGalleryProps {
  refreshTrigger: number; // Increment to force refresh
}

const HistoryGallery: React.FC<HistoryGalleryProps> = ({ refreshTrigger }) => {
  const [history, setHistory] = useState<ExperimentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRecord, setSelectedRecord] = useState<ExperimentRecord | null>(null);

  useEffect(() => {
    loadHistory();
  }, [refreshTrigger]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await getAllReadings();
      setHistory(data);
    } catch (e) {
      console.error("Failed to load history", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); // Prevent opening modal
    if (confirm("Are you sure you want to delete this record?")) {
      await deleteReading(id);
      loadHistory();
      if (selectedRecord?.id === id) setSelectedRecord(null);
    }
  };

  const downloadImage = (e: React.MouseEvent, blob: Blob, id: number) => {
    e.stopPropagation(); // Prevent opening modal
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `experiment_overlay_${id}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-4 text-center text-gray-500">Loading history...</div>;

  if (history.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">
        No history available yet. Create your first overlay!
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {history.map((record) => (
          <div 
            key={record.id} 
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedRecord(record)}
          >
            <div className="relative aspect-video bg-gray-100">
               <img 
                 src={URL.createObjectURL(record.processedImageBlob)} 
                 alt={`Record ${record.id}`} 
                 className="w-full h-full object-cover"
               />
               <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center group">
                 <span className="opacity-0 group-hover:opacity-100 bg-black/50 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">View Details</span>
               </div>
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <div className="text-xs text-gray-500 mb-2 font-mono">
                ID: {record.id} • {new Date(record.timestamp).toLocaleString()}
              </div>
              
              {/* Mini Preview of Data */}
              <div className="grid grid-cols-5 gap-1 mb-4">
                 {(Object.keys(record.readings) as Array<keyof typeof record.readings>)
                   .filter(key => record.readings[key] && record.readings[key].trim() !== '')
                   .map(key => (
                   <div key={key} className="bg-gray-50 rounded p-1 text-center">
                      <div className="text-[10px] text-gray-400 uppercase">{key}</div>
                      <div className="text-xs font-bold text-gray-700">{record.readings[key]}</div>
                   </div>
                 ))}
              </div>
              
              <div className="mt-auto flex gap-2">
                <button 
                  onClick={(e) => downloadImage(e, record.processedImageBlob, record.id)}
                  className="flex-1 px-3 py-2 bg-indigo-50 text-indigo-600 text-sm font-medium rounded hover:bg-indigo-100 transition-colors"
                >
                  Download
                </button>
                <button 
                  onClick={(e) => handleDelete(e, record.id)}
                  className="px-3 py-2 bg-red-50 text-red-600 text-sm font-medium rounded hover:bg-red-100 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedRecord(null)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row shadow-2xl" onClick={e => e.stopPropagation()}>
            
            {/* Image Side */}
            <div className="flex-1 bg-gray-900 flex items-center justify-center p-4 min-h-[300px]">
              <img 
                 src={URL.createObjectURL(selectedRecord.processedImageBlob)} 
                 alt="Detailed View" 
                 className="max-w-full max-h-[80vh] object-contain shadow-lg"
              />
            </div>

            {/* Info Side */}
            <div className="w-full md:w-80 flex flex-col p-6 bg-white border-l border-gray-100 overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Record Details</h3>
                  <p className="text-sm text-gray-500 font-mono mt-1">
                    {new Date(selectedRecord.timestamp).toLocaleString()}
                  </p>
                </div>
                <button onClick={() => setSelectedRecord(null)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4 mb-8">
                <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">Temperature Readings</h4>
                {(Object.entries(selectedRecord.readings) as [string, string][])
                  .filter(([_, value]) => value && value.trim() !== '')
                  .map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center py-2 border-b border-dashed border-gray-100 last:border-0">
                    <span className="text-gray-500 uppercase font-medium">{key}</span>
                    <span className="text-lg font-bold text-gray-800">{value}°C</span>
                  </div>
                ))}
              </div>

              <div className="mt-auto space-y-3">
                 <button 
                  onClick={(e) => downloadImage(e, selectedRecord.processedImageBlob, selectedRecord.id)}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-indigo-100 shadow-lg"
                 >
                   Save to Device
                 </button>
                 <button 
                  onClick={(e) => handleDelete(e, selectedRecord.id)}
                  className="w-full py-3 bg-white border border-red-200 text-red-600 rounded-xl font-semibold hover:bg-red-50 transition-colors"
                 >
                   Delete Record
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HistoryGallery;