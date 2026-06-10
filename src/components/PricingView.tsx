import React, { useState } from 'react';
import { Calculator, Table, Hash, Settings2, Save, Info, RefreshCw, Layers } from 'lucide-react';
import { DbCost, PricingSettings, Database } from '../types';

interface PricingViewProps {
  costs: DbCost[];
  databases: Database[];
  setDatabases: (dbs: Database[]) => void;
  settings: PricingSettings;
  setSettings: (s: PricingSettings) => void;
}

export function PricingView({ costs, databases, setDatabases, settings, setSettings }: PricingViewProps) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [isEditing, setIsEditing] = useState(false);

  const totalMonthly = costs.reduce((acc, c) => acc + (c.totalHr * 730), 0);
  const totalAnnual = costs.reduce((acc, c) => acc + (c.totalHr * 8760), 0);

  const handleSave = () => {
    setSettings(localSettings);
    setIsEditing(false);
  };

  const toggleDr = (dbId: string) => {
    const updated = databases.map(db => {
      if (db.id === dbId) {
        return { ...db, hasDr: db.hasDr === false ? true : false };
      }
      return db;
    });
    setDatabases(updated);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Settings / Assumptions Panel */}
      <div className="glass rounded-3xl p-8 overflow-hidden relative shadow-2xl border-white/10">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Calculator className="w-32 h-32 text-sky-400" />
        </div>
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <Settings2 className="w-4 h-4 text-sky-400" />
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-sky-400">Pricing Logic & Assumptions</h3>
            </div>
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="text-[10px] font-mono uppercase tracking-widest text-sky-400 hover:text-white transition-colors bg-white/5 px-3 py-1 rounded-lg border border-white/10"
              >
                Edit Assumptions
              </button>
            ) : (
              <button 
                onClick={handleSave}
                className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 hover:text-white transition-colors bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-2"
              >
                <Save className="w-3 h-3" /> Save Changes
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-2">
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest text-nowrap">ECPU $/hr (BYOL - B95704)</p>
              {!isEditing ? (
                <p className="text-2xl font-bold text-white">${settings.ecpuHr.toFixed(4)}</p>
              ) : (
                <input 
                  type="number" step="0.0001"
                  value={localSettings.ecpuHr}
                  onChange={e => setLocalSettings({...localSettings, ecpuHr: Number(e.target.value)})}
                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white w-full font-mono text-sm outline-none focus:border-sky-500"
                />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-[10px] text-sky-500 font-mono uppercase tracking-widest text-nowrap">AI DB Storage TP $/GB (B95706)</p>
              {!isEditing ? (
                <p className="text-2xl font-bold text-sky-400">${settings.dbStorageTpGbMonth.toFixed(4)}</p>
              ) : (
                <input 
                  type="number" step="0.0001"
                  value={localSettings.dbStorageTpGbMonth}
                  onChange={e => setLocalSettings({...localSettings, dbStorageTpGbMonth: Number(e.target.value)})}
                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white w-full font-mono text-sm outline-none focus:border-sky-500"
                />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-[10px] text-sky-500 font-mono uppercase tracking-widest text-nowrap">AI DB Storage $/GB (B9554)</p>
              {!isEditing ? (
                <p className="text-2xl font-bold text-sky-400">${settings.dbStorageGbMonth.toFixed(4)}</p>
              ) : (
                <input 
                  type="number" step="0.0001"
                  value={localSettings.dbStorageGbMonth}
                  onChange={e => setLocalSettings({...localSettings, dbStorageGbMonth: Number(e.target.value)})}
                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white w-full font-mono text-sm outline-none focus:border-sky-500"
                />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">DR Standby ECPU %</p>
              {!isEditing ? (
                <p className="text-2xl font-bold text-white">{settings.drEcpuPercent}%</p>
              ) : (
                <input 
                  type="number"
                  value={localSettings.drEcpuPercent}
                  onChange={e => setLocalSettings({...localSettings, drEcpuPercent: Number(e.target.value)})}
                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white w-full font-mono text-sm outline-none focus:border-sky-500"
                />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-[10px] text-emerald-500 font-mono uppercase tracking-widest">Backup Storage Growth (%)</p>
              {!isEditing ? (
                <p className="text-2xl font-bold text-emerald-400">{settings.backupStorageGrowthPercent}%</p>
              ) : (
                <input 
                  type="number"
                  value={localSettings.backupStorageGrowthPercent}
                  onChange={e => setLocalSettings({...localSettings, backupStorageGrowthPercent: Number(e.target.value)})}
                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white w-full font-mono text-sm outline-none focus:border-sky-500"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-8 pt-8 border-t border-white/5">
            <div className="space-y-2">
              <p className="text-[10px] text-sky-400 font-mono uppercase tracking-widest text-nowrap">Base DB ECPU $/hr (B111588)</p>
              {!isEditing ? (
                <p className="text-2xl font-bold text-white">${settings.baseDbEcpuHr.toFixed(4)}</p>
              ) : (
                <input 
                  type="number" step="0.0001"
                  value={localSettings.baseDbEcpuHr}
                  onChange={e => setLocalSettings({...localSettings, baseDbEcpuHr: Number(e.target.value)})}
                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white w-full font-mono text-sm outline-none focus:border-sky-500"
                />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-[10px] text-sky-400 font-mono uppercase tracking-widest text-nowrap">Base DB Storage $/GB (B111584)</p>
              {!isEditing ? (
                <p className="text-2xl font-bold text-sky-400">${settings.baseDbStorageGbMonth.toFixed(4)}</p>
              ) : (
                <input 
                  type="number" step="0.0001"
                  value={localSettings.baseDbStorageGbMonth}
                  onChange={e => setLocalSettings({...localSettings, baseDbStorageGbMonth: Number(e.target.value)})}
                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white w-full font-mono text-sm outline-none focus:border-sky-500"
                />
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-8 pt-8 border-t border-white/5">
            <div className="space-y-2">
              <p className="text-[10px] text-sky-500 font-mono uppercase tracking-widest">Auto-Scale High Util %</p>
              {!isEditing ? (
                <p className="text-xl font-bold text-white">{settings.serverlessHighUtilPercent}%</p>
              ) : (
                <input 
                  type="number"
                  value={localSettings.serverlessHighUtilPercent}
                  onChange={e => setLocalSettings({...localSettings, serverlessHighUtilPercent: Number(e.target.value)})}
                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white w-full font-mono text-sm outline-none focus:border-sky-500"
                />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-[10px] text-sky-500 font-mono uppercase tracking-widest">Auto-Scale High Time %</p>
              {!isEditing ? (
                <p className="text-xl font-bold text-white">{settings.serverlessHighTimePercent}%</p>
              ) : (
                <input 
                  type="number"
                  value={localSettings.serverlessHighTimePercent}
                  onChange={e => setLocalSettings({...localSettings, serverlessHighTimePercent: Number(e.target.value)})}
                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white w-full font-mono text-sm outline-none focus:border-sky-500"
                />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-[10px] text-sky-500 font-mono uppercase tracking-widest">Auto-Scale Low Util %</p>
              {!isEditing ? (
                <p className="text-xl font-bold text-white">{settings.serverlessLowUtilPercent}%</p>
              ) : (
                <input 
                  type="number"
                  value={localSettings.serverlessLowUtilPercent}
                  onChange={e => setLocalSettings({...localSettings, serverlessLowUtilPercent: Number(e.target.value)})}
                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white w-full font-mono text-sm outline-none focus:border-sky-500"
                />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-[10px] text-sky-500 font-mono uppercase tracking-widest">Auto-Scale Low Time %</p>
              {!isEditing ? (
                <p className="text-xl font-bold text-white">{settings.serverlessLowTimePercent}%</p>
              ) : (
                <input 
                  type="number"
                  value={localSettings.serverlessLowTimePercent}
                  onChange={e => setLocalSettings({...localSettings, serverlessLowTimePercent: Number(e.target.value)})}
                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white w-full font-mono text-sm outline-none focus:border-sky-500"
                />
              )}
            </div>
          </div>
          
          {settings.model !== 'Autonomous-Serverless' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8 pt-8 border-t border-white/5">
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">DB Server $/hr</p>
                {!isEditing ? (
                  <p className="text-xl font-bold text-white">${settings.dbServerHr.toFixed(4)}</p>
                ) : (
                  <input 
                    type="number" step="0.0001"
                    value={localSettings.dbServerHr}
                    onChange={e => setLocalSettings({...localSettings, dbServerHr: Number(e.target.value)})}
                    className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white w-full font-mono text-sm outline-none focus:border-sky-500"
                  />
                )}
              </div>
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Storage $/hr (Node)</p>
                {!isEditing ? (
                  <p className="text-xl font-bold text-white">${settings.storageServerHr.toFixed(4)}</p>
                ) : (
                  <input 
                    type="number" step="0.0001"
                    value={localSettings.storageServerHr}
                    onChange={e => setLocalSettings({...localSettings, storageServerHr: Number(e.target.value)})}
                    className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white w-full font-mono text-sm outline-none focus:border-sky-500"
                  />
                )}
              </div>
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Recovery $/GB</p>
                {!isEditing ? (
                  <p className="text-xl font-bold text-white">${settings.recoveryGbMonth.toFixed(3)}</p>
                ) : (
                  <input 
                    type="number" step="0.001"
                    value={localSettings.recoveryGbMonth}
                    onChange={e => setLocalSettings({...localSettings, recoveryGbMonth: Number(e.target.value)})}
                    className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white w-full font-mono text-sm outline-none focus:border-sky-500"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Pricing Table */}
      {/* Deployment & Pricing Assumptions moved here */}
      <div className="bg-sky-500/10 border border-sky-500/20 rounded-3xl p-8 flex flex-col gap-6">
        <div className="flex items-start gap-4">
          <div className="bg-white/5 p-2 rounded-xl text-sky-400 shadow-sm border border-white/10">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-sky-400 text-sm">Deployment & Pricing Assumptions</h4>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Model Context: {settings.model.replace('-', ' ')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {settings.model === 'ExaCS-Dedicated' && (
            <>
              <AssumptionCard title="License Model" description="All OCI components are priced using Bring Your Own License (BYOL) rates." />
              <AssumptionCard title="Analysis Context" description="Sizing is derived from EMCC report analysis and reflects AS-IS (unadjusted) configurations." />
              <AssumptionCard title="Data Protection" description="Backups for Primary and DR instances utilize Oracle Database Autonomous Recovery Service." />
              <AssumptionCard title="Backup Scope" description="Backup Storage is based on the Used Storage and does not include the future growth." />
              <AssumptionCard title="ECPU Rounding" description="ECPU count per database has been rounded to the nearest whole number." />
            </>
          )}

          {settings.model === 'Base-DB' && (
            <>
              <AssumptionCard title="ECPU Sizing" description="Identified ECPU = ROUNDUP(MAX(4, [DB vCPU]*2, [DB Memory (MB)]/1024/2)/4,0)*4." />
              <AssumptionCard title="Storage Selection" description="Allocated storage is rounded up to the nearest supported Oracle Base DB storage tier (up to 40TB)." />
              <AssumptionCard title="Monthly Charge" description="Storage charge based on SKU B111584: (Selected Storage * 1.25) + 205 GB." />
              <AssumptionCard title="Recovery Service" description="Oracle Database Autonomous Recovery Service charge is calculated based on Used Storage (GB)." />
              <AssumptionCard title="Infrastructure" description="No additional infrastructure (Node/Cell) costs are involved in the Base DB model." />
            </>
          )}
          
          {settings.model === 'Autonomous-Dedicated' && (
            <>
              <AssumptionCard title="License Model" description="All OCI components are priced using Bring Your Own License (BYOL) rates." />
              <AssumptionCard title="Adaptive Scaling" description={`Effective ECPU = ROUNDUP(MAX(2, (${settings.serverlessLowUtilPercent}% × [vCPU × 2] × ${settings.serverlessLowTimePercent}%) + (${settings.serverlessHighUtilPercent}% × [vCPU × 2] × ${settings.serverlessHighTimePercent}%)), 0). This ensures the minimum ECPU is set to 2 and everything is rounded to the nearest whole number.`} />
              <AssumptionCard title="Disaster Recovery" description="DR connectivity is maintained via Autonomous Data Guard, providing a 99.995% uptime SLA." />
              <AssumptionCard title="Data Protection" description="Backups for Primary and DR instances utilize Oracle Database Autonomous Recovery Service." />
              <AssumptionCard title="Backup Scope" description="Backup Storage is based on the Used Storage and does not include the future growth." />
              <AssumptionCard title="Analysis Context" description="Sizing is derived from EMCC report analysis and reflects AS-IS (unadjusted) configurations." />
            </>
          )}

          {settings.model === 'Autonomous-Serverless' && (
            <>
              <AssumptionCard title="License Model" description="All OCI components are priced using Bring Your Own License (BYOL) rates." />
              <AssumptionCard title="Adaptive Scaling" description={`Effective ECPU = ROUNDUP(MAX(2, (${settings.serverlessLowUtilPercent}% × [vCPU × 2] × ${settings.serverlessLowTimePercent}%) + (${settings.serverlessHighUtilPercent}% × [vCPU × 2] × ${settings.serverlessHighTimePercent}%)), 0). This ensures the minimum ECPU is set to 2 and everything is rounded to the nearest whole number.`} />
              <AssumptionCard title="Disaster Recovery" description="DR connectivity is maintained via Autonomous Data Guard, providing a 99.995% uptime SLA." />
              <AssumptionCard title="Backup Strategy" description="DR utilizing local backup-based recovery leverages existing automatic backups at no additional service charge." />
              <AssumptionCard title="Backup Scope" description="Backup Storage is based on the Used Storage and does not include the future growth." />
              <AssumptionCard title="Analysis Context" description="Sizing is derived from EMCC report analysis and reflects AS-IS (unadjusted) configurations." />
            </>
          )}
        </div>

        <p className="text-[10px] text-slate-500 italic mt-2 border-t border-white/5 pt-4">
          * Monthly estimates are calculated based on 730 hours. Annual estimates reflect 8,760 hours of operation. All infrastructure costs are prorated based on resource utilization.
        </p>
      </div>

      {/* Main Pricing Table */}
      <div className="glass rounded-3xl border border-white/10 shadow-2xl overflow-hidden mb-20">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <Table className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-white">Database Level Breakdown</h3>
          </div>
          <div className="flex gap-10">
            <div className="text-right">
              <p className="text-[9px] font-mono text-slate-500 uppercase">Monthly Subtotal</p>
              <p className="text-sm font-bold text-emerald-400">${totalMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-mono text-slate-500 uppercase">Annual Subtotal</p>
              <p className="text-sm font-bold text-white">${totalAnnual.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/10 text-slate-500">
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest font-bold">Database & Deployment</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest font-bold text-right text-slate-400">ECPU ($/mo)</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest font-bold text-right">Infra Breakdown ($/mo)</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest font-bold text-right">Backup ($/mo)</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest font-bold text-right text-sky-400">Monthly Subtotal</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest font-bold text-right bg-emerald-500/10 text-emerald-400">Annual Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {costs.map((cost) => {
                const dbSource = databases.find(d => d.id === cost.dbId);
                const isProd = cost.cohort.toLowerCase().includes('prod');
                const ecpuRate = cost.model === 'Base-DB' ? settings.baseDbEcpuHr : settings.ecpuHr;
                const primaryEcpu = cost.primary.ecpuCostHr / ecpuRate;
                const primaryInfraMonthly = (cost.primary.dbServerCostHr + cost.primary.storageServerCostHr) * 730;
                const primaryDbServerMonthly = cost.primary.dbServerCostHr * 730;
                const primaryStorageMonthly = cost.primary.storageServerCostHr * 730;
                const primaryBackupMonthly = cost.primary.recoveryCostMonth;
                
                return (
                  <React.Fragment key={cost.dbId}>
                    {/* Primary Row */}
                    <tr className="hover:bg-white/5 transition-colors group border-none">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-200 group-hover:text-white transition-colors flex items-center gap-2">
                            {cost.dbName}
                            {isProd && (
                              <button 
                                onClick={() => toggleDr(cost.dbId)}
                                className={`text-[8px] px-1.5 py-0.5 rounded-full border transition-all ${
                                  dbSource?.hasDr !== false 
                                    ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' 
                                    : 'bg-slate-500/10 text-slate-500 border-slate-500/30'
                                }`}
                              >
                                {dbSource?.hasDr !== false ? 'DR Enabled' : 'DR Disabled'}
                              </button>
                            )}
                            <span className="text-[8px] text-slate-500 font-mono italic">({cost.model})</span>
                          </span>
                          <span className="text-[9px] font-mono uppercase text-sky-500/60">
                            {(settings.model === 'Base-DB') ? 'Database Instance' : `Primary - ${cost.cohort}`}
                          </span>
                          {cost.model === 'Base-DB' && dbSource && (
                            <div className="flex flex-col gap-0.5 mt-1">
                              {(() => {
                                const ecpuMax = Math.max(4, dbSource.dbVcpu * 2, dbSource.dbMemoryMB / 1024 / 2);
                                const effectiveEcpus = Math.ceil(ecpuMax / 4) * 4;
                                const baseDbMemGb = effectiveEcpus * 2;
                                return (
                                  <>
                                    <span className="text-[8px] text-slate-400 font-mono italic">
                                      ECPU: {effectiveEcpus} | Memory: {baseDbMemGb}GB
                                    </span>
                                    <span className="text-[7px] text-slate-500 font-mono">
                                      {dbSource.dbVcpu} vC | {dbSource.dbMemoryMB}MB Source
                                    </span>
                                  </>
                                );
                              })()}
                              {(() => {
                                const allocated = dbSource.allocatedStorageGB;
                                if (allocated > 40960) {
                                  const used = dbSource.usedStorageGB;
                                  if (used > 40960) {
                                    return <span className="text-[8px] text-amber-500 font-mono">Using Max Storage Supported</span>;
                                  }
                                  return <span className="text-[8px] text-sky-400 font-mono italic">Using Used Storage Only</span>;
                                }
                                return null;
                              })()}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex flex-col">
                           <span className="text-sky-400 font-bold font-mono text-xs">{primaryEcpu.toFixed(2)}</span>
                           <span className="text-[9px] text-slate-500 font-mono">(${(cost.primary.ecpuCostHr * 730).toFixed(0)})</span>
                         </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex flex-col">
                           <div className="flex items-baseline justify-end gap-1">
                             <span className="text-slate-200 font-mono text-xs font-bold">${primaryInfraMonthly.toFixed(0)}</span>
                             <span className="text-[10px] text-slate-500 font-mono font-normal">/mo</span>
                           </div>
                           <div className="flex flex-col text-[8px] text-slate-500 leading-tight mt-1">
                             <span className="flex justify-between gap-4"><span>DB:</span> <span>${primaryDbServerMonthly.toFixed(0)}</span></span>
                             <span className="flex justify-between gap-4">
                               <span>Storage:</span> 
                               <span className="flex items-center gap-1">
                                 {settings.model === 'Autonomous-Serverless' && (
                                   <span className="text-[7px] text-slate-500 font-mono">
                                     ({(dbSource?.allocatedStorageGB ? (dbSource.allocatedStorageGB * (isProd ? 2 : 1) / 1024).toFixed(2) : 0)} TB)
                                   </span>
                                 )}
                                 <span>${primaryStorageMonthly.toFixed(0)}</span>
                               </span>
                             </span>
                           </div>
                         </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex flex-col">
                            <div className="flex items-baseline justify-end gap-1">
              {(() => {
                const isServerless = settings.model === 'Autonomous-Serverless';
                const growthFactor = 1 + (settings.backupStorageGrowthPercent / 100);
                const isDR = cost.dbCohort.toLowerCase() === 'dr';
                const capacityTB = (dbSource?.usedStorageGB && !(isServerless && isDR)) 
                  ? (dbSource.usedStorageGB * growthFactor) / 1024 
                  : 0;
                return (
                  <span className="text-emerald-400 font-mono text-xs font-bold">{capacityTB.toFixed(2)} TB</span>
                );
              })()}
                            </div>
                            <span className="text-[9px] text-slate-500 font-mono">(${primaryBackupMonthly.toFixed(0)})</span>
                         </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-xs text-sky-400/80">${(cost.primary.totalHr * 730).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="px-6 py-4 text-right font-mono text-xs font-bold bg-emerald-500/[0.02] text-emerald-400">${(cost.primary.totalHr * 8760).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    </tr>

                    {/* DR Row (Indented) */}
                    {cost.dr && (
                      <tr className="bg-white/5 border-none opacity-80 shadow-inner">
                        <td className="px-6 py-2 pl-12">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-mono uppercase text-emerald-500 flex items-center gap-2">
                              <RefreshCw className="w-2.5 h-2.5" /> DR Standby (Mirror)
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-2 text-right">
                          <div className="flex flex-col">
                            <span className="text-emerald-500/60 font-bold font-mono text-[10px]">{(cost.dr.ecpuCostHr / settings.ecpuHr).toFixed(2)}</span>
                            <span className="text-[9px] text-slate-500 font-mono">(${(cost.dr.ecpuCostHr * 730).toFixed(0)})</span>
                          </div>
                        </td>
                        <td className="px-6 py-2 text-right">
                          <div className="flex flex-col">
                            <div className="flex items-baseline justify-end gap-1">
                              <span className="text-slate-500 font-mono text-[10px] font-bold">${((cost.dr.dbServerCostHr + cost.dr.storageServerCostHr) * 730).toFixed(0)}</span>
                              <span className="text-[8px] text-slate-600 font-mono">/mo</span>
                            </div>
                            <div className="flex flex-col text-[7px] text-slate-600 leading-tight mt-0.5">
                             <span className="flex justify-between gap-4"><span>DB:</span> <span>${(cost.dr.dbServerCostHr * 730).toFixed(0)}</span></span>
                             <span className="flex justify-between gap-4">
                               <span>Storage:</span> 
                               <span className="flex items-center gap-1">
                                  {settings.model === 'Autonomous-Serverless' && (
                                    <span className="text-[6px] text-slate-500 font-mono">
                                      ({(dbSource?.allocatedStorageGB ? (dbSource.allocatedStorageGB * 1 / 1024).toFixed(2) : 0)} TB)
                                    </span>
                                  )}
                                  <span>${(cost.dr.storageServerCostHr * 730).toFixed(0)}</span>
                               </span>
                             </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-2 text-right">
                          <div className="flex flex-col">
                            {(() => {
                              const isServerless = settings.model === 'Autonomous-Serverless';
                              const growthFactor = 1 + (settings.backupStorageGrowthPercent / 100);
                              const capacityTB = (dbSource?.usedStorageGB && !isServerless)
                                ? (dbSource.usedStorageGB * growthFactor) / 1024 
                                : 0;
                              return (
                                <span className="text-emerald-500/60 font-mono text-[10px] font-bold">{capacityTB.toFixed(2)} TB</span>
                              );
                            })()}
                            <span className="text-[8px] text-slate-500 font-mono">(${cost.dr.recoveryCostMonth.toFixed(0)})</span>
                          </div>
                        </td>
                        <td className="px-6 py-2 text-right font-mono text-[10px] text-emerald-400/60">${(cost.dr.totalHr * 730).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="px-6 py-2 text-right font-mono text-[10px] font-bold text-emerald-500/80">${(cost.dr.totalHr * 8760).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      </tr>
                    )}
                    
                    {/* Database Subtotal Row */}
                    {cost.dr && (
                      <tr className="bg-white/[0.02] border-t border-white/5">
                        <td className="px-6 py-2 text-right text-[10px] font-mono uppercase text-slate-600 font-bold" colSpan={4}>Database Combined Total</td>
                        <td className="px-6 py-2 text-right font-mono text-[10px] text-sky-400 font-bold border-t border-sky-400/20">${(cost.totalHr * 730).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="px-6 py-2 text-right font-mono text-[10px] text-emerald-400 font-bold border-t border-emerald-400/20 bg-emerald-500/5">${(cost.totalHr * 8760).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AssumptionCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1.5">
      <h5 className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">{title}</h5>
      <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}
