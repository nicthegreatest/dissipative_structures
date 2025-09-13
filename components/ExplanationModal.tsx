
import React from 'react';

interface ExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  explanation: string;
  isLoading: boolean;
}

export const ExplanationModal: React.FC<ExplanationModalProps> = ({ isOpen, onClose, explanation, isLoading }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-brand-d-brown rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-brand-red">Thermodynamic Explanation</h2>
          <button onClick={onClose} className="text-brand-tan/80 hover:text-brand-tan">&times;</button>
        </div>
        <div>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center space-y-4 p-8">
              <div className="w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin"></div>
              <p className="text-brand-tan">Generating explanation with Gemini...</p>
            </div>
          ) : (
            <div className="prose prose-invert text-brand-tan max-w-none" dangerouslySetInnerHTML={{ __html: explanation.replace(/\n/g, '<br />') }} />
          )}
        </div>
      </div>
    </div>
  );
};