import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface FileUploaderProps {
  onDataLoaded: (data: any[]) => void;
}

export function FileUploader({ onDataLoaded }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/)) {
      setError('Invalid file format. Please upload an Excel sheet (.xlsx, .xls) or CSV.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);
        
        if (json.length === 0) {
          setError('The sheet appears to be empty.');
          return;
        }

        onDataLoaded(json);
      } catch (err) {
        setError('Failed to parse Excel file. Ensure it has the correct structure.');
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold tracking-tight mb-3 text-white">Begin Calculation</h2>
        <p className="text-slate-400 max-w-md mx-auto">
          Upload your database inventory Excel sheet to determine rack configuration and pricing estimates.
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-3xl p-12 transition-all cursor-pointer group glass
          ${isDragging 
            ? 'border-sky-500 bg-sky-500/10 scale-[1.02]' 
            : 'border-white/10 hover:border-white/20 hover:bg-white/5'}
        `}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="hidden" 
          accept=".xlsx, .xls, .csv"
        />
        
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform border border-white/10">
            <Upload className="w-8 h-8 text-sky-400" />
          </div>
          
          <div>
            <p className="text-lg font-medium text-white">Click to upload or drag and drop</p>
            <p className="text-sm text-slate-400 mt-1">Excel (.xlsx, .xls) or CSV supported</p>
          </div>

          <div className="flex items-center gap-4 py-4 px-6 bg-white/5 rounded-xl border border-white/10 group-hover:border-white/20 transition-colors">
            <FileSpreadsheet className="w-5 h-5 text-slate-400" />
            <div className="text-left">
              <p className="text-xs font-mono text-slate-400 uppercase tracking-wider">Required Columns</p>
              <p className="text-[10px] text-slate-500 leading-tight">
                Cohort, DB Name, Allocated Storage, Used Storage, DB vCPU, DB Memory, Cluster Name
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}
    </div>
  );
}
