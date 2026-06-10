import { Database, Rack, PricingSettings, DbCost, InfraModel } from '../types';
import { calculateCosts } from '../utils/calculator';
import { BarChart3, TrendingUp, Info } from 'lucide-react';
import { motion } from 'motion/react';

interface ComparisonViewProps {
  databases: Database[];
  racks: Rack[];
  settings: PricingSettings;
}

export function ComparisonView({ databases, racks, settings }: ComparisonViewProps) {
  const models: InfraModel[] = ['ExaCS-Dedicated', 'Autonomous-Dedicated', 'Autonomous-Serverless', 'Base-DB'];
  
  const modelData = models.map(m => {
    const modelSettings = { ...settings, model: m };
    const costs = calculateCosts(racks, modelSettings);
    const totalMonthly = costs.reduce((acc, c) => acc + (c.totalHr * 730), 0);
    const totalAnnual = totalMonthly * 12;
    return { model: m, totalMonthly, totalAnnual, costs };
  });

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {modelData.map((data, idx) => (
          <motion.div 
            key={data.model}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`glass rounded-3xl p-8 border ${data.model === settings.model ? 'border-sky-500/50 bg-sky-500/5' : 'border-white/10'}`}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">{data.model}</h3>
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-1">Infrastructure Profile</p>
              </div>
              <div className={`p-2 rounded-xl ${data.model === settings.model ? 'bg-sky-500/20 text-sky-400' : 'bg-white/5 text-slate-500'}`}>
                <BarChart3 className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Estimated Monthly Cost</p>
                <p className="text-3xl font-bold text-white tracking-tight">
                  ${data.totalMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Estimated Annual Cost</p>
                <p className="text-xl font-bold text-emerald-400 tracking-tight">
                  ${data.totalAnnual.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Inventory Size</span>
                <span className="text-white font-mono">{databases.length} DBs</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Efficiency Gap</span>
                <span className="text-sky-400 font-mono">
                  {idx === 0 ? 'Baseline' : `${((data.totalMonthly / modelData[0].totalMonthly - 1) * 100).toFixed(1)}%`}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="glass rounded-3xl border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10 bg-white/5">
          <h3 className="font-bold text-white flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-sky-400" />
            Cross-Model Comparison Matrix
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/10 text-slate-500">
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest">Database Name</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-right">ExaCS ($/mo)</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-right">ADB-D ($/mo)</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-right">ADB-S ($/mo)</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-right">Base-DB ($/mo)</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-right">Best Fit Model</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {databases.map(db => {
                const rowData = modelData.map(d => d.costs.find(c => c.dbId === db.id));
                const values = rowData.map(r => r ? r.totalHr * 730 : 0);
                const minVal = Math.min(...values);
                const bestFitIdx = values.indexOf(minVal);
                
                return (
                  <tr key={db.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-200">{db.dbName}</span>
                        <span className="text-[10px] font-mono text-slate-500 uppercase">{db.cohort}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-xs text-slate-400">
                      ${values[0].toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-xs text-slate-400">
                      ${values[1].toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-xs text-slate-400">
                      ${values[2].toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-xs text-slate-400">
                      ${values[3].toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="bg-sky-500/20 text-sky-400 text-[10px] font-bold px-2 py-1 rounded border border-sky-500/30 uppercase tracking-tight">
                        {models[bestFitIdx]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
