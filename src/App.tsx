/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Database, Rack, DbCost, PricingSettings, DEFAULT_SETTINGS } from './types';
import { processExcelData, groupIntoRacks, calculateCosts } from './utils/calculator';
import { FileUploader } from './components/FileUploader';
import { Dashboard } from './components/Dashboard';
import { Layout } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [databases, setDatabases] = useState<Database[] | null>(null);
  const [racks, setRacks] = useState<Rack[] | null>(null);
  const [costs, setCosts] = useState<DbCost[] | null>(null);
  const [settings, setSettings] = useState<PricingSettings>(DEFAULT_SETTINGS);

  const handleFileUpload = useCallback((data: any[]) => {
    const dbs = processExcelData(data);
    setDatabases(dbs);
    const groupedRacks = groupIntoRacks(dbs);
    setRacks(groupedRacks);
  }, []);

  // Recalculate costs whenever racks or settings change
  useEffect(() => {
    if (racks) {
      const calculatedCosts = calculateCosts(racks, settings);
      setCosts(calculatedCosts);
    } else {
      setCosts(null);
    }
  }, [racks, settings]);

  const reset = () => {
    setDatabases(null);
    setRacks(null);
    setCosts(null);
  };

  return (
    <div className="min-h-screen text-slate-50 font-sans selection:bg-sky-500/30 flex flex-col">
      <header className="glass border-b border-white/10 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-sky-500 p-2 rounded-lg shadow-[0_0_20px_rgba(56,189,248,0.4)]">
              <Layout className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-sky-400">Oracle Inventory Analysis</h1>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">v2.4 Production Planner | X11M Compatible</p>
            </div>
          </div>
          {databases && (
            <button 
              onClick={reset}
              className="text-xs font-semibold glass-card px-4 py-2 text-slate-300 hover:text-white hover:bg-white/10 transition-all"
            >
              Upload New Sheet
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 w-full flex-1">
        <AnimatePresence mode="wait">
          {!databases ? (
            <motion.div
              key="uploader"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <FileUploader onDataLoaded={handleFileUpload} />
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <Dashboard 
                databases={databases} 
                setDatabases={setDatabases}
                racks={racks!} 
                setRacks={setRacks}
                costs={costs!} 
                settings={settings}
                setSettings={setSettings}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-auto py-8 text-center text-neutral-400 text-sm">
        <p>© 2026 Oracle Cloud Infrastructure • Internal Architect Tool</p>
      </footer>
    </div>
  );
}
