import { Rack, Database, VMCluster, InfraModel } from '../types';
import { Server, ChevronDown, ChevronUp, Layers, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface InfrastructureViewProps {
  racks: Rack[];
  isAllExpanded?: boolean;
  addRack?: () => void;
  addCluster?: (rackId: string) => void;
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
  toggleSelection?: (id: string) => void;
  model?: InfraModel;
}

function InfrastructureDatabase({ db, clusterName, rackId, isSelectionMode, isSelected, toggleSelection, model }: { key?: string; db: Database; clusterName: string; rackId: string; isSelectionMode?: boolean; isSelected?: boolean; toggleSelection?: (id: string) => void; model?: InfraModel }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `infra-db-${db.id}`,
    data: {
      type: 'database',
      database: db,
      dbId: db.id,
      clusterName: clusterName,
      rackId: rackId
    }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 1,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 group/db-item text-[8px] font-mono truncate border-l pl-2 py-0.5 transition-colors ${isSelected ? 'border-sky-500 text-sky-400' : 'border-white/10 text-slate-500'}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing hover:text-white transition-colors">
        {isSelectionMode && toggleSelection ? (
           <div 
             onClick={(e) => { e.stopPropagation(); toggleSelection(db.id); }}
             className={`w-2 h-2 rounded-sm border cursor-pointer ${isSelected ? 'bg-sky-500 border-sky-500' : 'border-white/20'}`}
           />
        ) : (
          <div className="w-1.5 h-1.5 bg-slate-700 rounded-full" />
        )}
      </div>
      <span>{db.dbName}</span>
      {model === 'Base-DB' && (
        <span className="ml-auto text-[7px] text-sky-500/50 italic whitespace-nowrap">
          Curr ECPU: {db.dbVcpu * 2}
        </span>
      )}
    </div>
  );
}

function InfrastructureCluster({ 
  cluster, 
  rackId, 
  isSelectionMode, 
  toggleSelection, 
  selectedIds,
  model
}: { 
  key?: string;
  cluster: VMCluster; 
  rackId: string; 
  isSelectionMode?: boolean; 
  toggleSelection?: (id: string) => void; 
  selectedIds?: Set<string>; 
  model?: InfraModel;
}) {
  const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({
    id: `infra-cluster-${cluster.name}`,
    data: {
      type: 'cluster',
      cluster: cluster,
      rackId: rackId,
      clusterName: cluster.name
    }
  });

  const { isOver, setNodeRef: setDroppableRef } = useDroppable({
    id: `infra-drop-cluster-${cluster.name}`,
    data: {
      type: 'cluster',
      rackId: rackId,
      clusterName: cluster.name
    }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 2,
  };

  const setCombinedRef = (node: HTMLElement | null) => {
    setDraggableRef(node);
    setDroppableRef(node);
  };

  return (
    <div 
      ref={setCombinedRef}
      style={style}
      className={`bg-white/5 rounded p-2 border transition-all flex flex-col gap-2 ${selectedIds?.has(cluster.name) ? 'border-sky-500/50 bg-sky-500/5' : 'border-white/5'} ${isOver ? 'ring-2 ring-sky-500/50 bg-sky-500/10' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isSelectionMode && toggleSelection ? (
            <div 
              onClick={(e) => { e.stopPropagation(); toggleSelection(cluster.name); }}
              className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all cursor-pointer ${selectedIds?.has(cluster.name) ? 'bg-sky-500 border-sky-500 text-white' : 'border-white/20 bg-white/5'}`}
            >
              {selectedIds?.has(cluster.name) && <div className="w-1.5 h-1.5 bg-white rounded-[1px]" />}
            </div>
          ) : (
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing hover:text-sky-400 transition-colors">
              <Layers className="w-3 h-3 text-sky-500/40" />
            </div>
          )}
          <span className="text-[10px] font-medium text-slate-300 truncate max-w-[120px]">{cluster.name}</span>
        </div>
        <span className="text-[9px] text-slate-500 font-mono">{cluster.databases.length}D</span>
      </div>
      <div className="grid grid-cols-1 gap-1 pl-4">
        {cluster.databases.map(db => (
          <InfrastructureDatabase 
            key={db.id} 
            db={db} 
            clusterName={cluster.name}
            rackId={rackId}
            isSelectionMode={isSelectionMode} 
            isSelected={selectedIds?.has(db.id)} 
            toggleSelection={toggleSelection} 
            model={model}
          />
        ))}
      </div>
    </div>
  );
}

function InfrastructureRack({ 
  rack, 
  isExpanded, 
  toggleRack, 
  addCluster,
  isSelectionMode,
  isSelected,
  toggleSelection,
  selectedIds,
  model
}: { 
  key?: string | number, 
  rack: Rack, 
  isExpanded: boolean, 
  toggleRack: (id: string) => void, 
  addCluster?: (rackId: string) => void,
  isSelectionMode?: boolean,
  isSelected?: boolean,
  toggleSelection?: (id: string) => void,
  selectedIds?: Set<string>,
  model?: InfraModel
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `infra-${rack.id}`,
    data: {
      type: 'rack',
      rackId: rack.id
    }
  });

  return (
    <motion.div 
      ref={setNodeRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        minHeight: isExpanded ? 'auto' : '84px'
      }}
      className={`glass-card hover:bg-white/[0.03] transition-all border-white/5 relative overflow-hidden flex flex-col ${isOver ? 'ring-2 ring-sky-500 shadow-sky-500/20' : ''}`}
    >
      <div className="h-2 bg-sky-500/50 absolute top-0 left-0 right-0" />
      
      <div 
        className="p-5 flex flex-col flex-1 cursor-pointer"
        onClick={() => toggleRack(rack.id)}
      >
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-3">
            {isSelectionMode && toggleSelection && (
              <div 
                onClick={(e) => { e.stopPropagation(); toggleSelection(rack.id); }}
                className={`w-5 h-5 rounded border flex items-center justify-center transition-all cursor-pointer ${isSelected ? 'bg-sky-500 border-sky-500 text-white' : 'border-white/20 bg-white/5 hover:border-sky-500/50'}`}
              >
                {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-sm" />}
              </div>
            )}
            <div>
              <h4 className="font-mono font-bold text-sky-400 flex items-center gap-2">
                {rack.id.toUpperCase()}
                {isExpanded ? <ChevronUp className="w-3 h-3 text-slate-600" /> : <ChevronDown className="w-3 h-3 text-slate-600" />}
              </h4>
              <p className="text-[9px] text-slate-500 font-mono uppercase tracking-widest">
                {rack.numDbServers} Nodes / {rack.numStorageServers} cells
              </p>
            </div>
          </div>
          <Server className="w-5 h-5 text-slate-700" title="Rack Server" />
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-4 pt-4 border-t border-white/5 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-2 mb-6 flex-1">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[8px] text-slate-500 font-mono uppercase tracking-widest">Clusters</span>
                  {model !== 'Base-DB' && model !== 'Autonomous-Serverless' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); addCluster?.(rack.id); }}
                      className="p-1 hover:bg-sky-500/10 text-sky-400 rounded transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {rack.clusters.map((cluster, cIdx) => (
                  <InfrastructureCluster 
                    key={`${rack.id}-${cluster.name}-${cIdx}`}
                    cluster={cluster}
                    rackId={rack.id}
                    isSelectionMode={isSelectionMode}
                    toggleSelection={toggleSelection}
                    selectedIds={selectedIds}
                    model={model}
                  />
                ))}
                {rack.clusters.length === 0 && (
                  <div className="py-8 border border-dashed border-white/5 rounded-xl flex items-center justify-center">
                    <p className="text-[9px] text-slate-600 font-mono uppercase tracking-widest italic">No VM Clusters</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/5 rounded p-2 text-center">
                  <p className="text-[10px] font-bold text-white">
                    {rack.clusters.reduce((acc, c) => acc + c.totalVcpu, 0)}
                  </p>
                  <p className="text-[8px] text-slate-500 font-mono uppercase">vCPUs</p>
                </div>
                <div className="bg-white/5 rounded p-2 text-center">
                  <p className="text-[10px] font-bold text-white">
                    {Math.round(rack.totalMemoryCapacityMB / 1024)}G
                  </p>
                  <p className="text-[8px] text-slate-500 font-mono uppercase">RAM</p>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/5">
                  <div>
                    <div className="flex justify-between items-baseline">
                      <p className="text-[8px] text-slate-500 font-mono uppercase">Memory Util</p>
                      <span className="text-[9px] font-bold text-sky-400">
                        {Math.round((rack.actualMemoryUsageMB / rack.totalMemoryCapacityMB) * 100)}%
                      </span>
                    </div>
                    <div className="h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                      <div 
                        className="h-full bg-sky-500" 
                        style={{ width: `${(rack.actualMemoryUsageMB / rack.totalMemoryCapacityMB) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-baseline">
                      <p className="text-[8px] text-slate-500 font-mono uppercase">Storage Util</p>
                      <span className="text-[9px] font-bold text-emerald-400">
                        {Math.round((rack.actualStorageUsageGB / rack.totalStorageCapacityGB) * 100)}%
                      </span>
                    </div>
                    <div className="h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500" 
                        style={{ width: `${(rack.actualStorageUsageGB / rack.totalStorageCapacityGB) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
            </motion.div>
          )}
        </AnimatePresence>

        {rack.isDr && (
          <div className="absolute top-0 right-0 bg-emerald-500/10 text-emerald-400 text-[8px] font-bold px-2 py-0.5 rounded-bl border-l border-b border-emerald-500/20">
            DR MIRROR
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function InfrastructureView({ 
  racks, 
  isAllExpanded = true, 
  addRack, 
  addCluster,
  isSelectionMode,
  selectedIds,
  toggleSelection,
  model
}: InfrastructureViewProps) {
  const [expandedRacks, setExpandedRacks] = useState<Record<string, boolean>>({});
  
  useEffect(() => {
    setExpandedRacks(prev => {
      const next = { ...prev };
      racks.forEach(r => {
        if (next[r.id] === undefined) {
          next[r.id] = isAllExpanded;
        }
      });
      return next;
    });
  }, [racks]);

  // Separate effect to handle "Expand All / Collapse All" buttons
  useEffect(() => {
    const next: Record<string, boolean> = {};
    racks.forEach(r => {
      next[r.id] = isAllExpanded;
    });
    setExpandedRacks(next);
  }, [isAllExpanded, racks.length]);

  const isServerlessManaged = model === 'Base-DB' || model === 'Autonomous-Serverless';

  if (isServerlessManaged) {
    const allDbs = racks.flatMap(r => r.clusters.flatMap(c => c.databases));
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-mono uppercase tracking-widest text-slate-500">Managed Database Instances</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {allDbs.map(db => (
            <div key={db.id} className="glass-card p-4 border-white/5 hover:bg-white/[0.03] transition-all flex flex-col gap-2 relative">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                   <div className="w-2 h-2 bg-sky-500 rounded-full" />
                   <span className="text-xs font-bold text-white">{db.dbName}</span>
                 </div>
                 {model === 'Base-DB' && (
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] text-sky-500/50 italic font-mono">
                      ECPU: {Math.ceil(Math.max(4, db.dbVcpu * 2, db.dbMemoryMB / 1024 / 2) / 4) * 4}
                    </span>
                    <span className="text-[7px] text-slate-500 font-mono">
                      Curr: {db.dbVcpu * 2}
                    </span>
                  </div>
                 )}
               </div>
               <div className="flex gap-4 mt-2 pt-2 border-t border-white/5">
                 <div className="flex flex-col">
                   <span className="text-[8px] text-slate-500 font-mono uppercase">ECPU</span>
                   <span className="text-[10px] font-bold text-sky-400">
                     {(() => {
                        const ecpuMax = Math.max(4, db.dbVcpu * 2, db.dbMemoryMB / 1024 / 2);
                        return Math.ceil(ecpuMax / 4) * 4;
                     })()}
                   </span>
                 </div>
                 <div className="flex flex-col">
                   <span className="text-[8px] text-slate-500 font-mono uppercase">Memory</span>
                   <span className="text-10px font-bold text-slate-300">
                     {(() => {
                        const ecpuMax = Math.max(4, db.dbVcpu * 2, db.dbMemoryMB / 1024 / 2);
                        const effectiveEcpus = Math.ceil(ecpuMax / 4) * 4;
                        return effectiveEcpus * 2;
                     })()} GB
                   </span>
                 </div>
                 <div className="flex flex-col">
                   <span className="text-[8px] text-slate-500 font-mono uppercase">Storage</span>
                   <span className="text-10px font-bold text-slate-300">
                     {(() => {
                        const tiers = [256, 512, 1024, 2048, 4096, 8192, 16384, 24576, 32768, 40960];
                        let val = db.allocatedStorageGB;
                        if (val > 40960) val = db.usedStorageGB;
                        if (val > 40960) val = 40960;
                        return tiers.find(t => t >= val) || 40960;
                     })()} GB
                   </span>
                 </div>
               </div>
            </div>
          ))}
          {allDbs.length === 0 && (
            <div className="col-span-full py-12 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-slate-600 gap-2">
              <Layers className="w-8 h-8 opacity-20" />
              <p className="text-xs font-mono uppercase tracking-widest italic">No Databases Provisioned</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const cohorts = Array.from(new Set(racks.map(r => r.cohort)));

  const toggleRack = (id: string) => {
    setExpandedRacks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-mono uppercase tracking-widest text-slate-500">Rack Infrastructure Layout</h3>
        {!isSelectionMode && (
          <button 
            onClick={addRack}
            className="flex items-center gap-2 px-3 py-1.5 bg-sky-500 text-white rounded-lg text-[10px] font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-sky-500/20"
          >
            <Plus className="w-3 h-3" /> New Rack
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-12">
        {cohorts.map(cohortName => {
          const cohortRacks = racks.filter(r => r.cohort === cohortName);
          const isNonProd = cohortName === 'Non-Production';

          return (
            <div key={cohortName} className="space-y-6">
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                  isNonProd ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                } border ${isNonProd ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
                  {cohortName} Deployment
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {cohortRacks.map((rack, idx) => {
                  const isExpanded = expandedRacks[rack.id] ?? true;
                  return (
                    <InfrastructureRack 
                      key={rack.id} 
                      rack={rack} 
                      isExpanded={isExpanded} 
                      toggleRack={toggleRack} 
                      addCluster={addCluster}
                      isSelectionMode={isSelectionMode}
                      isSelected={selectedIds?.has(rack.id)}
                      toggleSelection={toggleSelection}
                      selectedIds={selectedIds}
                      model={model}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
