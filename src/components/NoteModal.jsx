// src/components/NoteModal.jsx — portal modal for adding/editing a town note

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Trash2 } from 'lucide-react';

export default function NoteModal({ townName, currentNote = '', onSave, onClose }) {
  const [text, setText] = useState(currentNote);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleSave() { onSave(text); onClose(); }
  function handleDelete() { onSave(''); onClose(); }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Note</p>
            <h3 className="text-[15px] font-bold text-gray-900 mt-0.5">{townName}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors mt-0.5 shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pt-4 pb-2">
          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave(); }}
            placeholder="Write your thoughts about this town…"
            rows={5}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] text-gray-700 leading-relaxed resize-none outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent placeholder:text-gray-400"
          />
          <p className="text-[10px] text-gray-400 mt-1.5">⌘ + Enter to save</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4">
          {currentNote ? (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 text-[12px] text-red-500 hover:text-red-700 font-medium transition-colors"
            >
              <Trash2 size={13} />
              Delete note
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 h-8 text-[12px] text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 h-8 bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-semibold rounded-lg transition-colors"
            >
              <Save size={12} />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
