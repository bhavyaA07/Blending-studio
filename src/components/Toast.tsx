import React from 'react';

interface ToastProps {
  message: string;
  icon?: string;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, icon = 'info', onClose }) => {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#1b1c1a] text-[#ffffff] px-4 py-3 rounded-xl shadow-2xl border border-[#4c5762]/30 animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-md">
      <span className="material-symbols-outlined text-[#ffb4a2] text-[20px]">{icon}</span>
      <span className="text-[13px] font-sans font-medium flex-1">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="text-[#8a726c] hover:text-[#ffffff] transition-colors cursor-pointer"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
};
