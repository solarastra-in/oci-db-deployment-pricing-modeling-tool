import { Rack, VMCluster, Database, InfraModel } from '../types';
import { 
  Server, Database as DbIcon, HardDrive, Cpu, Layers, Info, 
  ChevronDown, ChevronUp, Plus, GripVertical, MoveHorizontal 
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface GroupingViewProps {
  racks: Rack[];
  isAllExpanded?: boolean;
  addRack: () => void;
  addCluster: (rackId: string) => void;
  addDbToCluster: (rackId: string, clusterName: string, dbId: string) => void;
  allDatabases: Database[];
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
  toggleSelection?: (id: string) => void;
  model?: InfraModel;
}

interface DraggableClusterProps {
  key?: string | number;
  cluster: VMCluster;
  rackId: string;
  addDbToCluster: (rackId: string, clusterName: string, dbId: string) => void;
  allDatabases: Database[];
  isSelectionMode?: boolean;
  isSelected?: boolean;
  toggleSelection?: (id: string) => void;
  selectedIds?: Set<string>;
  model?: InfraModel;
}

function DraggableCluster({ cluster, rackId, addDbToCluster, allDatabases, isSelectionMode, isSelected, toggleSelection, selectedIds, model }: DraggableClusterProps) {
  const [dbSearch, setDbSearch] = useState('');
  const [showDbList, setShowDbList] = useState(false);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `cluster-${rackId}-${cluster.name}`,
    data: {
      type: 'cluster',
      rackId,
      clusterName: cluster.name
    }
  });

  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `droppable-cluster-${rackId}-${cluster.name}`,
    data: {
      type: 'cluster',
      rackId,
      clusterName: cluster.name
    }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 100 : 1,
  };

  const filteredDbs = allDatabases
    .filter(db => !cluster.databases.some(cd => cd.id === db.id))
    .filter(db => db.dbName.toLowerCase().includes(dbSearch.toLowerCase()))
    .slice(0, 5);

  return (
    <div 
      ref={(node) => {
        setNodeRef(node);
        setDropRef(node);
      }}
      style={style}
      className={`glass-card p-6 border-white/5 hover:border-white/10 transition-all flex flex-col gap-4 group/cluster relative ${isOver ? 'ring-2 ring-sky-500/50 bg-sky-500/5' : ''}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          {isSelectionMode && toggleSelection ? (
            <div 
              onClick={(e) => { e.stopPropagation(); toggleSelection(cluster.name); }}
              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer ${isSelected ? 'bg-sky-500 border-sky-500 text-white' : 'border-white/20 bg-white/5 hover:border-sky-500/50'}`}
            >
              {isSelected && <Plus className="w-3.5 h-3.5 rotate-45" style={{ transform: 'rotate(0deg)' }} />}
              {isSelected && (
                <div className="w-2.5 h-2.5 bg-white rounded-sm" />
              )}
            </div>
          ) : (
            <div 
              {...attributes} {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-white/10 rounded text-slate-500"
            >
              <GripVertical className="w-4 h-4" />
            </div>
          )}
          <div className="bg-white/5 p-2 rounded-lg text-slate-400 group-hover/cluster:text-sky-400 transition-colors border border-white/10">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white">{cluster.name}</h4>
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">{cluster.databases.length} Databases</p>
              <span className="w-1 h-1 bg-slate-700 rounded-full" />
              <p className="text-[9px] text-sky-500/60 font-mono">{cluster.cohort}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 py-3 border-y border-white/5">
        <div>
          <p className="text-[9px] text-slate-500 font-mono uppercase text-nowrap">Memory</p>
          <p className="text-sm font-semibold text-slate-200">{(cluster.totalMemoryMB / 1024).toFixed(1)} GB</p>
        </div>
        <div>
          <p className="text-[9px] text-slate-500 font-mono uppercase text-nowrap">Storage</p>
          <p className="text-sm font-semibold text-slate-200">{cluster.totalAllocatedGB.toLocaleString()} GB</p>
        </div>
        <div>
          <p className="text-[9px] text-slate-500 font-mono uppercase text-nowrap">ECPUs</p>
          <p className="text-sm font-semibold text-slate-200">{cluster.totalVcpu * 2}</p>
        </div>
      </div>

      <div className="relative">
        <div className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 focus-within:ring-1 focus-within:ring-sky-500/50">
          <Plus className="w-3 h-3 text-slate-500" />
          <input 
            type="text"
            value={dbSearch}
            onChange={(e) => {
              setDbSearch(e.target.value);
              setShowDbList(true);
            }}
            onFocus={() => setShowDbList(true)}
            placeholder="Add database by name..."
            className="bg-transparent border-none outline-none text-[10px] text-white placeholder-slate-600 w-full"
          />
        </div>
        
        <AnimatePresence>
          {showDbList && dbSearch && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-white/10 rounded-lg z-[150] shadow-2xl overflow-hidden"
              onMouseLeave={() => setShowDbList(false)}
            >
              {filteredDbs.map(db => (
                <div 
                  key={db.id}
                  onClick={() => {
                    addDbToCluster(rackId, cluster.name, db.id);
                    setDbSearch('');
                    setShowDbList(false);
                  }}
                  className="px-3 py-2 hover:bg-white/5 cursor-pointer text-[10px] text-slate-300 transition-colors border-b border-white/5 last:border-none flex justify-between"
                >
                  <span>{db.dbName}</span>
                  <span className="text-slate-600">{db.dbVcpu}vC</span>
                </div>
              ))}
              {filteredDbs.length === 0 && (
                <div className="px-3 py-2 text-[9px] text-slate-500 italic">No available DBs...</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
        {cluster.databases.map((db) => (
          <DraggableDatabase 
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
        {cluster.databases.length === 0 && (
          <div className="col-span-2 py-4 border-2 border-dashed border-white/5 rounded-lg flex items-center justify-center">
             <p className="text-[8px] text-slate-600 font-mono uppercase">Empty Cluster</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface DraggableDatabaseProps {
  key?: string | number;
  db: Database;
  clusterName: string;
  rackId: string;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  toggleSelection?: (id: string) => void;
  model?: InfraModel;
}

function DraggableDatabase({ db, clusterName, rackId, isSelectionMode, isSelected, toggleSelection, model }: DraggableDatabaseProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `db-${db.id}`,
    data: {
      type: 'database',
      dbId: db.id,
      clusterName,
      rackId
    }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 100 : 1,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`flex justify-between items-center bg-white/[0.02] p-2 rounded-lg border transition-colors group/db ${isSelected ? 'border-sky-500/50 bg-sky-500/5' : 'border-white/5 hover:border-white/10'}`}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        {isSelectionMode && toggleSelection ? (
          <div 
            onClick={(e) => { e.stopPropagation(); toggleSelection(db.id); }}
            className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${isSelected ? 'bg-sky-500 border-sky-500' : 'border-white/20 bg-white/5'}`}
          >
            {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-[1px]" />}
          </div>
        ) : (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-700 hover:text-slate-500">
             <GripVertical className="w-2.5 h-2.5" />
          </div>
        )}
        <DbIcon className="w-3 h-3 text-sky-500/50 flex-shrink-0" />
        <span className="text-[10px] font-medium text-slate-300 truncate">{db.dbName}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {model === 'Base-DB' && (
          <span className="text-[7px] text-sky-500/50 italic whitespace-nowrap">
            {db.dbVcpu * 2} E
          </span>
        )}
        <span className="text-[8px] font-mono text-slate-600">{db.dbVcpu}vC</span>
      </div>
    </div>
  );
}

interface RackContainerProps {
  key?: string | number;
  rack: Rack;
  isExpanded: boolean;
  toggleRack: (id: string) => void;
  addCluster: (rackId: string) => void;
  addDbToCluster: (rackId: string, clusterName: string, dbId: string) => void;
  allDatabases: Database[];
  isSelectionMode?: boolean;
  isSelected?: boolean;
  toggleSelection?: (id: string) => void;
  selectedIds?: Set<string>;
  model?: InfraModel;
}

function RackContainer({ rack, isExpanded, toggleRack, addCluster, addDbToCluster, allDatabases, isSelectionMode, isSelected, toggleSelection, selectedIds, model }: RackContainerProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: rack.id,
    data: {
      type: 'rack',
      rackId: rack.id
    }
  });

  const totalClusters = rack.clusters.length;
  // Aggregate total DBs across clusters
  const totalDbs = rack.clusters.reduce((acc, c) => acc + c.databases.length, 0);

  return (
    <div ref={setNodeRef} className={`glass rounded-3xl border border-white/10 overflow-hidden shadow-2xl relative group transition-all ${isOver ? 'ring-2 ring-sky-500 shadow-sky-500/20' : ''}`}>
      {/* Rack Header */}
      <div 
        onClick={() => toggleRack(rack.id)}
        className="bg-white/5 border-b border-white/10 p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 cursor-pointer hover:bg-white/[0.08] transition-all"
      >
        <div className="flex items-center gap-4">
          {isSelectionMode && toggleSelection && (
            <div 
              onClick={(e) => { e.stopPropagation(); toggleSelection(rack.id); }}
              className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${isSelected ? 'bg-sky-500 border-sky-500 text-white shadow-lg' : 'border-white/20 bg-white/5 hover:border-sky-500/50'}`}
            >
              {isSelected && <div className="w-3 h-3 bg-white rounded-sm" />}
            </div>
          )}
          <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center text-white font-mono font-bold shadow-[0_0_15px_rgba(56,189,248,0.4)]">
            {rack.id.includes('-') ? rack.id.split('-').pop() : 'NP'}
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight text-white flex items-center gap-3 text-nowrap overflow-hidden">
              {rack.id.toUpperCase()}
              {rack.isDr && <span className="text-[10px] text-emerald-500/60 font-normal tracking-widest">(DISASTER RECOVERY)</span>}
              {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                rack.cohort.toLowerCase().includes('prod') 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}>
                {rack.cohort}
              </span>
              <span className="text-xs text-slate-500 font-mono">X11M ARCHITECTURE</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400 border border-sky-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Clusters</p>
              <p className="text-lg font-bold leading-none text-white">{totalClusters}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400 border border-sky-500/20">
              <DbIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">DBs</p>
              <p className="text-lg font-bold leading-none text-white">{totalDbs}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/5 rounded-lg text-slate-400 border border-white/10">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Nodes</p>
              <p className="text-lg font-bold leading-none text-white">{rack.numDbServers}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/5 rounded-lg text-slate-400 border border-white/10">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Cells</p>
              <p className="text-lg font-bold leading-none text-white">{rack.numStorageServers}</p>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {/* Rack Capacity Visualizers */}
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-white/5 bg-white/[0.02]">
              <div>
                <div className="flex justify-between text-xs font-mono uppercase mb-2">
                  <span className="text-slate-400">Memory Allocation</span>
                  <span className="font-bold text-sky-400">
                    {(rack.actualMemoryUsageMB / (1024 * 1024)).toFixed(1)} TB / {(rack.totalMemoryCapacityMB / (1024 * 1024)).toFixed(1)} TB
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden flex">
                  <div 
                    className="bg-sky-500 h-full shadow-[0_0_10px_rgba(56,189,248,0.5)] transition-all duration-1000" 
                    style={{ width: `${Math.min(100, (rack.actualMemoryUsageMB / rack.totalMemoryCapacityMB) * 100)}%` }} 
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-mono uppercase mb-2">
                  <span className="text-slate-400">Storage Allocation</span>
                  <span className="font-bold text-emerald-400">
                    {(rack.actualStorageUsageGB / 1024).toFixed(1)} TB / {(rack.totalStorageCapacityGB / 1024).toFixed(1)} TB
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden flex">
                  <div 
                    className="bg-emerald-500 h-full shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-1000" 
                    style={{ width: `${Math.min(100, (rack.actualStorageUsageGB / rack.totalStorageCapacityGB) * 100)}%` }} 
                  />
                </div>
              </div>
            </div>

            {/* Clusters Grid */}
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h5 className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Virtual Machine Clusters</h5>
                {model !== 'Base-DB' && model !== 'Autonomous-Serverless' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); addCluster(rack.id); }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-lg text-xs font-bold hover:bg-sky-500/20 transition-all"
                  >
                    <Plus className="w-3 h-3" /> New Cluster
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 min-h-[120px]">
                {rack.clusters.map((cluster, cIdx) => (
                  <DraggableCluster 
                    key={`${rack.id}-${cluster.name}-${cIdx}`} 
                    cluster={cluster} 
                    rackId={rack.id} 
                    addDbToCluster={addDbToCluster}
                    allDatabases={allDatabases}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedIds?.has(cluster.name)}
                    toggleSelection={toggleSelection}
                    selectedIds={selectedIds}
                    model={model}
                  />
                ))}
                {rack.clusters.length === 0 && (
                  <div className="xl:col-span-2 h-[100px] border-2 border-dashed border-white/5 rounded-2xl flex items-center justify-center text-slate-700">
                    <p className="text-sm font-mono uppercase tracking-widest">Drop clusters here</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function GroupingView({ 
  racks, 
  isAllExpanded = true, 
  addRack, 
  addCluster, 
  addDbToCluster, 
  allDatabases,
  isSelectionMode,
  selectedIds,
  toggleSelection,
  model
}: GroupingViewProps) {
  const [expandedRacks, setExpandedRacks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const initialState: Record<string, boolean> = {};
    racks.forEach(r => {
      initialState[r.id] = isAllExpanded;
    });
    setExpandedRacks(initialState);
  }, [isAllExpanded, racks]);

  const toggleRack = (id: string) => {
    setExpandedRacks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isServerlessManaged = model === 'Base-DB' || model === 'Autonomous-Serverless';

  if (isServerlessManaged) {
    const allDbs = racks.flatMap(r => r.clusters.flatMap(c => c.databases));
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <Info className="w-4 h-4 text-sky-400" />
            <p className="text-xs text-sky-200 font-medium">
              Direct Database Inventory view for managed infrastructure models.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {allDbs.map(db => (
            <div key={db.id} className="glass p-5 rounded-2xl border border-white/10 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <DbIcon className="w-4 h-4 text-sky-500" />
                  <span className="font-bold text-white tracking-wide">{db.dbName}</span>
                </div>
                {model === 'Base-DB' && (
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded font-mono">
                      {Math.ceil(Math.max(4, db.dbVcpu * 2, db.dbMemoryMB / 1024 / 2) / 4) * 4} ECPU
                    </span>
                    <span className="text-[7px] text-slate-500 font-mono mt-0.5">
                      Curr: {db.dbVcpu * 2}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-500 font-mono uppercase">ECPU</span>
                  <span className="text-xs font-semibold text-sky-400">
                    {(() => {
                        const ecpuMax = Math.max(4, db.dbVcpu * 2, db.dbMemoryMB / 1024 / 2);
                        return Math.ceil(ecpuMax / 4) * 4;
                    })()}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-500 font-mono uppercase">RAM</span>
                  <span className="text-xs font-semibold text-slate-300">
                    {(() => {
                        const ecpuMax = Math.max(4, db.dbVcpu * 2, db.dbMemoryMB / 1024 / 2);
                        const effectiveEcpus = Math.ceil(ecpuMax / 4) * 4;
                        return effectiveEcpus * 2;
                    })()}GB
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-500 font-mono uppercase">Storage</span>
                  <span className="text-xs font-semibold text-slate-300">
                     {(() => {
                        const tiers = [256, 512, 1024, 2048, 4096, 8192, 16384, 24576, 32768, 40960];
                        let val = db.allocatedStorageGB;
                        if (val > 40960) val = db.usedStorageGB;
                        if (val > 40960) val = 40960;
                        return tiers.find(t => t >= val) || 40960;
                     })()}GB
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <Info className="w-4 h-4 text-sky-400" />
          <p className="text-xs text-sky-200 font-medium">
            {isSelectionMode ? 'Multi-select mode active. Select items to perform bulk actions.' : 'Logical view allows mapping databases to clusters and clusters to racks using Drag & Drop.'}
          </p>
        </div>
        {!isSelectionMode && (
          <button 
            onClick={addRack}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-sky-500/20 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> Create New Rack
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8">
        {racks.map((rack) => (
          <RackContainer 
            key={rack.id} 
            rack={rack} 
            isExpanded={expandedRacks[rack.id] ?? true} 
            toggleRack={toggleRack}
            addCluster={addCluster}
            addDbToCluster={addDbToCluster}
            allDatabases={allDatabases}
            isSelectionMode={isSelectionMode}
            isSelected={selectedIds?.has(rack.id)}
            toggleSelection={toggleSelection}
            selectedIds={selectedIds}
            model={model}
          />
        ))}
      </div>
    </div>
  );
}
