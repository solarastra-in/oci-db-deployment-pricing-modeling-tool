import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutGrid, CircleDollarSign, Database as DbIcon, HardDrive, Cpu, Box, Filter, Download, 
  Search, X, Layers as LayersIcon, Server, BarChart2, Plus, GripVertical, Trash2, Upload
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragEndEvent,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  horizontalListSortingStrategy
} from '@dnd-kit/sortable';
import { Database, Rack, DbCost, PricingSettings, InfraModel, VMCluster } from '../types';
import { refreshClusterStats, refreshRackStats } from '../utils/calculator';
import { GroupingView } from './GroupingView';
import { PricingView } from './PricingView';
import { InfrastructureView } from './InfrastructureView';
import { ComparisonView } from './ComparisonView';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardProps {
  databases: Database[];
  setDatabases: (dbs: Database[]) => void;
  racks: Rack[];
  setRacks: (racks: Rack[]) => void;
  costs: DbCost[];
  settings: PricingSettings;
  setSettings: (s: PricingSettings) => void;
}

export function Dashboard({ databases, setDatabases, racks, setRacks, costs, settings, setSettings }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'grouping' | 'pricing' | 'infra' | 'comparison'>('grouping');
  const [cohortFilter, setCohortFilter] = useState<string>('all');
  const [dbSearch, setDbSearch] = useState<string>('');
  const [selectedDbs, setSelectedDbs] = useState<string[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isAllExpanded, setIsAllExpanded] = useState(true);

  // Management State
  const [committedRacks, setCommittedRacks] = useState<Rack[]>(racks);
  const [workingRacks, setWorkingRacks] = useState<Rack[]>(racks);

  // Synchronize internal states if racks prop changes externally (e.g. fresh upload)
  useEffect(() => {
    setCommittedRacks(racks);
    setWorkingRacks(racks);
  }, [racks]);

  const [isRackModalOpen, setIsRackModalOpen] = useState(false);
  const [isClusterModalOpen, setIsClusterModalOpen] = useState<{ isOpen: boolean; rackId: string }>({ isOpen: false, rackId: '' });
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [changeLog, setChangeLog] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Form State
  const [newRackName, setNewRackName] = useState('');
  const [newRackCohort, setNewRackCohort] = useState('Non-Production');
  const [newClusterName, setNewClusterName] = useState('');
  const [isExistingCluster, setIsExistingCluster] = useState(false);
  const [selectedExistingCluster, setSelectedExistingCluster] = useState('');
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const toggleEntitySelection = (id: string) => {
    setSelectedEntityIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedEntityIds(new Set());
    setIsSelectionMode(false);
  };

  const bulkDeleteSelected = () => {
    let nextRacks = [...workingRacks];
    
    selectedEntityIds.forEach(id => {
      // 1. Remove Databases
      nextRacks = nextRacks.map(r => ({
        ...r,
        clusters: r.clusters.map(c => ({
          ...c,
          databases: c.databases.filter(d => d.id !== id)
        }))
      }));

      // 2. Remove Clusters
      nextRacks = nextRacks.map(r => ({
        ...r,
        clusters: r.clusters.filter(c => c.name !== id)
      }));

      // 3. Remove Racks (if empty)
      nextRacks = nextRacks.filter(r => r.id !== id || r.clusters.length === 0);
    });

    setWorkingRacks(nextRacks.map(r => refreshRackStats(r)));
    clearSelection();
  };

  const handleInfrastructureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames.find(n => n === "Infrastructure Details") || workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any>(sheet);

        if (rows.length === 0) {
          alert("Selected Excel file is empty or missing 'Infrastructure Details' tab.");
          return;
        }

        const newRacks: Rack[] = [];
        let currentRack: Rack | null = null;
        let currentCluster: VMCluster | null = null;

        rows.forEach((row: any) => {
          const type = (row.Type || '').trim();
          const id = (row.ID || '').trim();
          
          if (type === 'RACK') {
            if (currentRack) {
              if (currentCluster) currentRack.clusters.push(refreshClusterStats(currentCluster));
              newRacks.push(refreshRackStats(currentRack));
            }
            currentCluster = null;
            currentRack = {
              id: id,
              cohort: row.Cohort || 'Non-Production',
              numDbServers: parseInt(row.Nodes) || 2,
              numStorageServers: parseInt(row.Cells) || 3,
              clusters: [],
              totalMemoryCapacityMB: (parseInt(row.Nodes) || 2) * 1.39 * 1024 * 1024,
              totalStorageCapacityGB: (parseInt(row.Cells) || 3) * 88 * 1024,
              actualMemoryUsageMB: 0,
              actualStorageUsageGB: 0
            };
          } else if (type === 'CLUSTER' && currentRack) {
            if (currentCluster) {
              currentRack.clusters.push(refreshClusterStats(currentCluster));
            }
            currentCluster = {
              name: id,
              cohort: currentRack.cohort,
              databases: [],
              totalMemoryMB: 0,
              totalAllocatedGB: 0,
              totalUsedGB: 0,
              totalVcpu: 0
            };
          } else if (type === 'DATABASE' && currentCluster) {
            const dbRef = databases.find(d => d.dbName === id) || databases[0]; // fallback to some existing ref if needed
            currentCluster.databases.push({
              ...dbRef,
              id: dbRef.id,
              dbName: id,
              dbVcpu: parseInt(row.vCPU) || dbRef.dbVcpu,
              dbMemoryMB: parseInt(row.Memory) || dbRef.dbMemoryMB,
              allocatedStorageGB: parseInt(row.Storage) || dbRef.allocatedStorageGB,
              clusterName: currentCluster.name
            });
          }
        });

        // Push last entities
        if (currentRack) {
          if (currentCluster) currentRack.clusters.push(refreshClusterStats(currentCluster));
          newRacks.push(refreshRackStats(currentRack));
        }

        if (newRacks.length > 0) {
          setWorkingRacks(newRacks);
          alert(`Successfully uploaded infrastructure with ${newRacks.length} racks.`);
        }
      } catch (err) {
        console.error("Excel Parse error:", err);
        alert("Error parsing infrastructure file. Please ensure it follows the exported 'Infrastructure Details' format.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (!activeData) return;

    // Move Cluster between Racks
    if (activeData.type === 'cluster' && (overData?.type === 'rack' || overData?.type === 'cluster')) {
      const activeRackId = activeData.rackId;
      const targetRackId = overData.type === 'rack' ? over.id : overData.rackId;
      const clusterName = activeData.clusterName;

      if (activeRackId === targetRackId && overData.type === 'cluster') {
        const rack = workingRacks.find(r => r.id === activeRackId);
        if (!rack) return;
        const oldIndex = rack.clusters.findIndex(c => c.name === clusterName);
        const newIndex = rack.clusters.findIndex(c => c.name === overData.clusterName);
        const newRacks = workingRacks.map(r => {
          if (r.id === activeRackId) {
            return { ...r, clusters: arrayMove(r.clusters, oldIndex, newIndex) };
          }
          return r;
        });
        setWorkingRacks(newRacks);
        return;
      }

      const activeRack = workingRacks.find(r => r.id === activeRackId);
      const targetRack = workingRacks.find(r => r.id === targetRackId);
      if (!activeRack || !targetRack) return;

      const clusterToMove = activeRack.clusters.find(c => c.name === clusterName);
      if (!clusterToMove) return;

      const newRacks = workingRacks.map(r => {
        if (r.id === activeRackId) {
          const newClusters = r.clusters.filter(c => c.name !== clusterName);
          return refreshRackStats({ ...r, clusters: newClusters });
        }
        if (r.id === targetRackId) {
          const newClusters = [...r.clusters, clusterToMove];
          return refreshRackStats({ ...r, clusters: newClusters });
        }
        return r;
      });
      setWorkingRacks(newRacks);
    }

    // Move Database between Clusters
    if (activeData.type === 'database') {
      const activeClusterName = activeData.clusterName;
      const activeRackId = activeData.rackId;
      const targetClusterName = overData?.type === 'cluster' ? overData.clusterName : (overData?.type === 'database' ? overData.clusterName : null);
      const targetRackId = overData?.rackId;
      const dbId = activeData.dbId;

      if (!targetClusterName || !targetRackId) return;

      const newRacks = workingRacks.map(r => {
        let updated = false;

        const newClusters = r.clusters.map(cluster => {
          if (r.id === activeRackId && cluster.name === activeClusterName) {
            updated = true;
            const newDbs = cluster.databases.filter(d => d.id !== dbId);
            return refreshClusterStats({ ...cluster, databases: newDbs });
          }
          if (r.id === targetRackId && cluster.name === targetClusterName) {
            updated = true;
            const dbToMove = workingRacks.find(r2 => r2.id === activeRackId)?.clusters.find(c => c.name === activeClusterName)?.databases.find(d => d.id === dbId);
            if (!dbToMove) return cluster;
            const newDbs = [...cluster.databases, { ...dbToMove, clusterName: targetClusterName }];
            return refreshClusterStats({ ...cluster, databases: newDbs });
          }
          return cluster;
        });

        if (updated) {
          return refreshRackStats({ ...r, clusters: newClusters });
        }
        return r;
      });
      setWorkingRacks(newRacks);
    }
  };

  const openAddRackModal = () => {
    setNewRackName(`RACK-${workingRacks.length + 1}`);
    setNewRackCohort('Non-Production');
    setIsRackModalOpen(true);
  };

  const confirmAddRack = () => {
    const id = newRackName || `RACK-NEW-${workingRacks.length + 1}`;
    const newRack: Rack = {
      id,
      cohort: newRackCohort,
      clusters: [],
      numDbServers: 2,
      numStorageServers: 3,
      totalMemoryCapacityMB: 2 * 1.39 * 1024 * 1024,
      totalStorageCapacityGB: 3 * 88 * 1024,
      actualMemoryUsageMB: 0,
      actualStorageUsageGB: 0
    };
    setWorkingRacks([...workingRacks, newRack]);
    setIsRackModalOpen(false);
  };

  const openAddClusterModal = (rackId: string) => {
    const rack = workingRacks.find(r => r.id === rackId);
    if (!rack) return;
    
    setNewClusterName(`CL-${rackId.split('-').pop()}-${Date.now().toString().slice(-4)}`);
    setIsExistingCluster(false);
    setSelectedExistingCluster('');
    setIsClusterModalOpen({ isOpen: true, rackId });
  };

  const confirmAddCluster = () => {
    const rackId = isClusterModalOpen.rackId;
    const rack = workingRacks.find(r => r.id === rackId);
    if (!rack) return;

    let clusterToAdd: VMCluster;

    if (isExistingCluster) {
      const existing = workingRacks.flatMap(r => r.clusters).find(c => c.name === selectedExistingCluster);
      if (!existing) return;
      clusterToAdd = { ...existing, cohort: rack.cohort };
      // Note: We might need to handle removing it from original rack here or during save
    } else {
      clusterToAdd = {
        name: newClusterName,
        cohort: rack.cohort,
        databases: [],
        totalMemoryMB: 0,
        totalAllocatedGB: 0,
        totalUsedGB: 0,
        totalVcpu: 0
      };
    }

    const newRacks = workingRacks.map(r => {
      if (r.id === rackId) {
        return { ...r, clusters: [...r.clusters, clusterToAdd] };
      }
      // If moving existing, remove from old rack
      if (isExistingCluster && r.id !== rackId) {
         const hasCluster = r.clusters.some(c => c.name === selectedExistingCluster);
         if (hasCluster) {
           return refreshRackStats({ ...r, clusters: r.clusters.filter(c => c.name !== selectedExistingCluster) });
         }
      }
      return r;
    });
    setWorkingRacks(newRacks);
    setIsClusterModalOpen({ isOpen: false, rackId: '' });
  };

  const triggerSaveSummary = () => {
    const log: string[] = [];
    const errors: string[] = [];
    
    // Compare workingRacks with committedRacks
    // 1. Validation for Max 8 Clusters (Production Only)
    workingRacks.forEach(rack => {
      if (rack.cohort.toLowerCase() === 'production' && rack.clusters.length > 8) {
        errors.push(`Production Rack ${rack.id} has ${rack.clusters.length} VM Clusters. Maximum allowed is 8.`);
      }
    });

    // 2. Planning Final State (Cleaned)
    const finalRacks = workingRacks
      .map(r => ({
        ...r,
        clusters: r.clusters
          .filter(c => c.databases.length > 0)
          .map(c => refreshClusterStats(c))
      }))
      .filter(r => r.clusters.length > 0)
      .map(r => refreshRackStats(r));

    // 3. Find EXACT DELTAS from committedRacks
    // New Racks
    finalRacks.forEach(fr => {
      if (!committedRacks.find(cr => cr.id === fr.id)) {
        log.push(`NEW RACK: ${fr.id} will be created.`);
      }
    });

    // Removed Entities
    committedRacks.forEach(cr => {
      const fr = finalRacks.find(r => r.id === cr.id);
      if (!fr) {
        log.push(`DELETE RACK: ${cr.id} removed from configuration.`);
      } else {
        // Check clusters in this rack
        cr.clusters.forEach(cc => {
          const fc = fr.clusters.find(c => c.name === cc.name);
          if (!fc) {
            // Cluster is gone from THIS rack, check if it moved elsewhere
            const movedTo = finalRacks.find(r => r.clusters.some(c => c.name === cc.name));
            if (movedTo) {
              log.push(`MOVE CLUSTER: ${cc.name} moved from Rack ${cr.id} to ${movedTo.id}`);
            } else {
              log.push(`DELETE CLUSTER: ${cc.name} removed from ${cr.id}.`);
            }
          } else {
            // Check databases in this cluster
            cc.databases.forEach(cd => {
              const fdb = fc.databases.find(d => d.id === cd.id);
              if (!fdb) {
                // DB is gone from THIS cluster, see if it moved elsewhere
                const newClusterLoc = finalRacks.flatMap(r => r.clusters).find(c => c.databases.some(d => d.id === cd.id));
                if (newClusterLoc) {
                  const newRackLoc = finalRacks.find(r => r.clusters.some(c => c.name === newClusterLoc.name));
                  const fromRack = cr.id;
                  const toRack = newRackLoc?.id || 'Unknown';
                  
                  if (fromRack !== toRack || cc.name !== newClusterLoc.name) {
                    log.push(`MOVE DATABASE: ${cd.dbName} relocated from Cluster ${cc.name} (${fromRack}) to ${newClusterLoc.name} (${toRack})`);
                  }
                } else {
                  log.push(`REMOVE DATABASE: ${cd.dbName} removed from configuration.`);
                }
              }
            });
          }
        });
      }
    });

    // New Clusters added to existing/new Racks (that didn't exist anywhere before)
    finalRacks.forEach(fr => {
      fr.clusters.forEach(fc => {
        const existedBefore = committedRacks.flatMap(r => r.clusters).some(c => c.name === fc.name);
        if (!existedBefore) {
          log.push(`NEW CLUSTER: ${fc.name} added to ${fr.id}`);
        }
      });
    });

    setChangeLog(log);
    setValidationErrors(errors);
    setIsSaveModalOpen(true);
  };

  const confirmSave = () => {
    const finalRacks = workingRacks
      .map(r => ({
        ...r,
        clusters: r.clusters
          .filter(c => c.databases.length > 0)
          .map(c => refreshClusterStats(c))
      }))
      .filter(r => r.clusters.length > 0)
      .map(r => refreshRackStats(r));

    setRacks(finalRacks);
    setCommittedRacks(finalRacks);
    setWorkingRacks(finalRacks);
    setIsSaveModalOpen(false);
  };

  const discardChanges = () => {
    setWorkingRacks(committedRacks);
  };

  const availableClustersForSelection = useMemo(() => {
    return Array.from(new Set(workingRacks.flatMap(r => r.clusters.map(c => c.name))));
  }, [workingRacks]);

  // Handle manual DB addition to cluster
  const addDbToCluster = (rackId: string, clusterName: string, dbId: string) => {
    const dbToMove = databases.find(d => d.id === dbId);
    if (!dbToMove) return;

    const newRacks = workingRacks.map(r => {
      // Remove from old location
      const newClusters = r.clusters.map(cluster => {
        const dbs = cluster.databases.filter(d => d.id !== dbId);
        // Add to new location
        if (r.id === rackId && cluster.name === clusterName) {
          return refreshClusterStats({ ...cluster, databases: [...dbs, { ...dbToMove, clusterName }] });
        }
        return refreshClusterStats({ ...cluster, databases: dbs });
      });
      return refreshRackStats({ ...r, clusters: newClusters });
    });
    setWorkingRacks(newRacks);
  };

  const cohorts = useMemo(() => {
    const list = ['all', ...Array.from(new Set(databases.map(db => db.cohort)))];
    // Add DR to filter list if any database has a DR side
    if (costs.some(c => c.dr)) list.push('DR');
    return list;
  }, [databases, costs]);

  const uniqueNames = useMemo(() => {
    const dbNames = databases.map(db => ({ name: db.dbName, type: 'DB' }));
    const clusterNames = Array.from(new Set(databases.map(db => db.clusterName))).map(name => ({ name, type: 'CLUSTER' }));
    return [...dbNames, ...clusterNames].sort((a, b) => a.name.localeCompare(b.name));
  }, [databases]);

  const filteredSearchList = useMemo(() => {
    if (!dbSearch) return uniqueNames.slice(0, 10);
    return uniqueNames.filter(n => n.name.toLowerCase().includes(dbSearch.toLowerCase())).slice(0, 10);
  }, [uniqueNames, dbSearch]);

  const filteredRacks = useMemo(() => {
    const baseRacks = workingRacks.filter(r => !r.isDr);
    
    const filtered = baseRacks.filter(r => {
      // Cohort Filter
      const matchCohort = cohortFilter === 'all' || r.cohort === cohortFilter || r.clusters.some(c => c.cohort === cohortFilter);
      if (!matchCohort) return false;

      // search filter (Name or Cluster)
      if (dbSearch || selectedDbs.length > 0) {
        const searchArr = selectedDbs.length > 0 ? selectedDbs : [dbSearch];
        return r.clusters.some(cluster => 
          searchArr.some(term => {
            const tLower = term.toLowerCase();
            return cluster.name.toLowerCase().includes(tLower) ||
                   cluster.databases.some(db => db.dbName.toLowerCase().includes(tLower));
          })
        );
      }

      return true;
    });

    // Deep filter the racks to only show matching clusters/databases if a search is active
    if (dbSearch || selectedDbs.length > 0) {
      const searchTerms = selectedDbs.length > 0 ? selectedDbs : [dbSearch];
      
      return filtered.map(rack => {
        const matchingClusters = rack.clusters.filter(cluster => {
          // A cluster matches if its name matches OR it has matching databases
          const clusterMatches = searchTerms.some(term => cluster.name.toLowerCase().includes(term.toLowerCase()));
          const hasMatchingDbs = cluster.databases.some(db => 
            searchTerms.some(term => db.dbName.toLowerCase().includes(term.toLowerCase()))
          );
          return clusterMatches || hasMatchingDbs;
        }).map(cluster => {
          const clusterNameMatches = searchTerms.some(term => cluster.name.toLowerCase().includes(term.toLowerCase()));
          
          const matchingDbs = cluster.databases.filter(db => 
            searchTerms.some(term => db.dbName.toLowerCase().includes(term.toLowerCase()))
          );

          // If we are searching/selecting specifically for databases, only show those databases.
          // If we matched the cluster but no databases matched the specific search terms, 
          // we only show all databases IF nothing else matched in the cluster.
          // The goal is "granular hiding".
          
          let finalDbs = matchingDbs;
          
          // If the cluster header matched but no DBs matched, and we aren't in a "select multiple DBs" mode, 
          // show all DBs to allow the user context of what's in that cluster.
          // BUT if they selected specific DBs, only show those.
          if (finalDbs.length === 0 && clusterNameMatches && selectedDbs.length === 0) {
            finalDbs = cluster.databases;
          }

          // CRITICAL: If we are searching and this cluster is matched ONLY because of a database match,
          // then we MUST only return the matching databases and NOT include the non-matching ones.
          // If the cluster name does NOT match, we only show matching DBs.
          if (!clusterNameMatches && finalDbs.length > 0) {
            finalDbs = matchingDbs;
          }

          return {
            ...cluster,
            databases: finalDbs
          };
        });

        return { ...rack, clusters: matchingClusters };
      }).filter(rack => rack.clusters.length > 0);
    }

    return filtered;
  }, [workingRacks, cohortFilter, dbSearch, selectedDbs]);

  const filteredCosts = useMemo(() => {
    return costs.filter(c => {
      const matchCohort = cohortFilter === 'all' || c.dbCohort === cohortFilter;
      
      let matchSearch = true;
      if (selectedDbs.length > 0) {
        const dbSource = databases.find(db => db.id === c.dbId);
        matchSearch = selectedDbs.some(term => {
          const tLower = term.toLowerCase();
          return c.dbName.toLowerCase() === tLower || 
                 (dbSource?.clusterName.toLowerCase() === tLower);
        });
      } else if (dbSearch) {
        const searchLower = dbSearch.toLowerCase();
        const dbSource = databases.find(db => db.id === c.dbId);
        matchSearch = c.dbName.toLowerCase().includes(searchLower) || 
                      (dbSource?.clusterName.toLowerCase().includes(searchLower) ?? false);
      }

      return matchCohort && matchSearch;
    });
  }, [costs, cohortFilter, selectedDbs, dbSearch, databases]);

  const stats = useMemo(() => {
    const dbs = databases; // Calculate all, filter in UI
    const primaryRacks = racks.filter(r => !r.isDr);
    const drRacksCount = racks.filter(r => r.isDr).length;
    
    const rackStats = {
      prod: primaryRacks.filter(r => r.cohort.toLowerCase().includes('prod')).length,
      nonProd: primaryRacks.filter(r => r.cohort === 'Non-Production').length,
      dr: drRacksCount
    };

    const totalHr = filteredCosts.reduce((acc, c) => acc + c.totalHr, 0);

    // Cohort Breakdown
    const cohortBreakdown: Record<string, { dbs: number; storage: number; memory: number; ecpu: number; backup: number; backupGB: number; storageCost: number; memoryCost: number }> = {};
    
    // Always include a DR bucket if we have DR costs
    if (costs.some(c => c.dr)) {
      cohortBreakdown["DR"] = { dbs: 0, storage: 0, memory: 0, ecpu: 0, backup: 0, backupGB: 0, storageCost: 0, memoryCost: 0 };
    }

    dbs.forEach(db => {
      const costEntry = filteredCosts.find(c => c.dbId === db.id);
      if (!costEntry) return; // Skip if filtered out

      const cohort = db.cohort;
      if (!cohortBreakdown[cohort]) {
        cohortBreakdown[cohort] = { dbs: 0, storage: 0, memory: 0, ecpu: 0, backup: 0, backupGB: 0, storageCost: 0, memoryCost: 0 };
      }
      
      // Primary Side
      cohortBreakdown[cohort].dbs += 1;
        
        const isServerless = settings.model === 'Autonomous-Serverless';
        const isBaseDb = settings.model === 'Base-DB';
        const isProdDB = db.cohort.toLowerCase() === 'production';
        const isDR_DB = db.cohort.toLowerCase() === 'dr';
        
        let sizedStorageGB = db.allocatedStorageGB;
        let sizedMemoryMB = db.dbMemoryMB;
        let sizedBackupGB = db.usedStorageGB;

        if (isBaseDb) {
          const ecpuMax = Math.max(4, db.dbVcpu * 2, db.dbMemoryMB / 1024 / 2);
          const effectiveEcpus = Math.ceil(ecpuMax / 4) * 4;
          sizedMemoryMB = effectiveEcpus * 2 * 1024;
          sizedBackupGB = db.usedStorageGB;
          
          if (db.allocatedStorageGB <= 40960) {
            const tiers = [256, 512, 1024, 2048, 4096, 8192, 16384, 24576, 32768, 40960];
            sizedStorageGB = tiers.find(t => t >= db.allocatedStorageGB) || 40960;
          } else if (db.usedStorageGB <= 40960) {
            const tiers = [256, 512, 1024, 2048, 4096, 8192, 16384, 24576, 32768, 40960];
            sizedStorageGB = tiers.find(t => t >= db.usedStorageGB) || 40960;
          } else {
            sizedStorageGB = 40960;
          }
        } else if (isServerless) {
          const multiplier = isProdDB ? 2 : 1;
          sizedStorageGB = db.allocatedStorageGB * multiplier;
        }

        cohortBreakdown[cohort].storage += sizedStorageGB;
        cohortBreakdown[cohort].memory += sizedMemoryMB;
        
        const baseRate = isBaseDb ? settings.baseDbEcpuHr : settings.ecpuHr;
        const growthFactor = 1 + (settings.backupStorageGrowthPercent / 100);
        
        cohortBreakdown[cohort].ecpu += (costEntry.primary.ecpuCostHr / baseRate);
        cohortBreakdown[cohort].backup += costEntry.primary.recoveryCostMonth;
        
        const backupMultiplier = (isServerless && isDR_DB) ? 0 : 1;
        const finalBackupGB = isBaseDb ? sizedBackupGB : (db.usedStorageGB * growthFactor * backupMultiplier);
        cohortBreakdown[cohort].backupGB += finalBackupGB;
        
        // Portion infra costs
        cohortBreakdown[cohort].memoryCost += costEntry.primary.dbServerCostHr * 730;
        cohortBreakdown[cohort].storageCost += costEntry.primary.storageServerCostHr * 730;

        // DR Side - Move to separate DR cohort
        if (costEntry.dr) {
          const drCohort = "DR";
          if (!cohortBreakdown[drCohort]) {
            cohortBreakdown[drCohort] = { dbs: 0, storage: 0, memory: 0, ecpu: 0, backup: 0, backupGB: 0, storageCost: 0, memoryCost: 0 };
          }
          cohortBreakdown[drCohort].dbs += 1;
          
          if (isBaseDb) {
             cohortBreakdown[drCohort].storage += sizedStorageGB;
             cohortBreakdown[drCohort].memory += sizedMemoryMB;
             cohortBreakdown[drCohort].ecpu += (costEntry.dr.ecpuCostHr / baseRate);
             cohortBreakdown[drCohort].backup += costEntry.dr.recoveryCostMonth;
             cohortBreakdown[drCohort].backupGB += sizedBackupGB;
          } else if (isServerless) {
            cohortBreakdown[drCohort].storage += db.allocatedStorageGB * 1;
            cohortBreakdown[drCohort].memory += db.dbMemoryMB;
            cohortBreakdown[drCohort].ecpu += (costEntry.dr.ecpuCostHr / baseRate);
            cohortBreakdown[drCohort].backup += costEntry.dr.recoveryCostMonth;
            cohortBreakdown[drCohort].backupGB += 0;
          } else {
             cohortBreakdown[drCohort].storage += db.allocatedStorageGB;
             cohortBreakdown[drCohort].memory += db.dbMemoryMB;
             cohortBreakdown[drCohort].ecpu += (costEntry.dr.ecpuCostHr / baseRate);
             cohortBreakdown[drCohort].backup += costEntry.dr.recoveryCostMonth;
             cohortBreakdown[drCohort].backupGB += (db.usedStorageGB * growthFactor);
          }
          
          cohortBreakdown[drCohort].memoryCost += costEntry.dr.dbServerCostHr * 730;
          cohortBreakdown[drCohort].storageCost += costEntry.dr.storageServerCostHr * 730;
        }
    });

    const totalDbServers = racks.reduce((acc, r) => acc + r.numDbServers, 0);
    const totalStorageServers = racks.reduce((acc, r) => acc + r.numStorageServers, 0);
    const totalBackup = Object.values(cohortBreakdown).reduce((acc, c) => acc + c.backup, 0);
    const totalEcpuValue = Object.values(cohortBreakdown).reduce((acc, c) => acc + c.ecpu, 0);
    const totalBackupGB = Object.values(cohortBreakdown).reduce((acc, c) => acc + c.backupGB, 0);

    return {
      totalHourly: totalHr,
      totalMonthly: totalHr * 730,
      totalAnnual: totalHr * 730 * 12,
      totalRacks: primaryRacks.length + drRacksCount,
      rackStats,
      totalDbServers,
      totalStorageServers,
      cohortBreakdown,
      totalDbs: Object.values(cohortBreakdown).reduce((acc, c) => acc + c.dbs, 0),
      totalStorageTB: (Object.values(cohortBreakdown).reduce((acc, c) => acc + c.storage, 0) / 1024).toFixed(1),
      totalMemoryTB: (Object.values(cohortBreakdown).reduce((acc, c) => acc + c.memory, 0) / (1024 * 1024)).toFixed(1),
      totalEcpu: totalEcpuValue.toFixed(1),
      totalBackup,
      totalBackupGB
    };
  }, [databases, filteredCosts, racks, cohortFilter, settings]);

  const getAssumptions = () => {
    const list: { title: string; desc: string }[] = [];
    
    // Global Assumptions
    list.push({ title: 'Backup Scope', desc: 'Backup Storage is based on the Used Storage and does not include the future growth.' });

    if (settings.model === 'ExaCS-Dedicated') {
      list.push({ title: 'License Model', desc: 'Bring Your Own License (BYOL)' });
      list.push({ title: 'Sizing', desc: 'Based on EMCC unadjusted analysis' });
      list.push({ title: 'Backups', desc: 'Backups for Primary and DR instances utilize Oracle Database Autonomous Recovery Service.' });
      list.push({ title: 'ECPU Rounding', desc: 'ECPU count per database has been rounded to the nearest whole number.' });
    } else if (settings.model === 'Autonomous-Dedicated') {
      list.push({ title: 'License Model', desc: 'Bring Your Own License (BYOL)' });
      list.push({ title: 'ECPU Profile', desc: `Effective ECPU = ROUNDUP(MAX(2, (${settings.serverlessLowUtilPercent}% × [vCPU × 2] × ${settings.serverlessLowTimePercent}%) + (${settings.serverlessHighUtilPercent}% × [vCPU × 2] × ${settings.serverlessHighTimePercent}%)), 0). This ensures the minimum ECPU is set to 2 and everything is rounded to the nearest whole number.` });
      list.push({ title: 'DR', desc: 'Autonomous Data Guard (99.995% SLA)' });
      list.push({ title: 'Backups', desc: 'Backups for Primary and DR instances utilize Oracle Database Autonomous Recovery Service.' });
      list.push({ title: 'Sizing', desc: 'Based on EMCC unadjusted analysis' });
    } else if (settings.model === 'Autonomous-Serverless') {
      list.push({ title: 'License Model', desc: 'Bring Your Own License (BYOL)' });
      list.push({ title: 'ECPU Profile', desc: `Effective ECPU = ROUNDUP(MAX(2, (${settings.serverlessLowUtilPercent}% × [vCPU × 2] × ${settings.serverlessLowTimePercent}%) + (${settings.serverlessHighUtilPercent}% × [vCPU × 2] × ${settings.serverlessHighTimePercent}%)), 0). This ensures the minimum ECPU is set to 2 and everything is rounded to the nearest whole number.` });
      list.push({ title: 'DR', desc: 'Autonomous Data Guard (99.995% SLA)' });
      list.push({ title: 'Backups', desc: 'Automatic backups (no extra charge)' });
      list.push({ title: 'Sizing', desc: 'Based on EMCC unadjusted analysis' });
    } else if (settings.model === 'Base-DB') {
      list.push({ title: 'Infra Sizing', desc: 'Identify ECPU = ROUNDUP(MAX(4, [DB vCPU]*2, [DB Memory (MB)]/1024/2)/4,0)*4' });
      list.push({ title: 'Storage Logic', desc: 'Oracle Base DB storage tiers logic (up to 40TB supported)' });
      list.push({ title: 'Pricing SKUs', desc: 'B111584 (Storage) and B111588 (ECPU)' });
      list.push({ title: 'Recovery Service', desc: 'Calculated based on Used Storage (GB)' });
      list.push({ title: 'Infrastructure', desc: 'No additional infra fees (Nodes/Cells)' });
    }
    return list;
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Cost Analysis
    const costData = filteredCosts.map(cost => {
      const dbSource = databases.find(d => d.id === cost.dbId);
      const ecpuPrimary = cost.primary.ecpuCostHr / settings.ecpuHr;
      const ecpuDR = cost.dr ? (cost.dr.ecpuCostHr / settings.ecpuHr) : 0;
      
      // Rounding up to 2 decimals as "nearest decimal"
      const roundUp = (num: number) => Math.ceil(num * 100) / 100;

      return {
        'DB Name': cost.dbName,
        'Cohort': cost.dbCohort,
        'Infra Model': cost.model,
        'Primary vCPU': dbSource?.dbVcpu || 0,
        'Primary ECPU (Scaled)': roundUp(ecpuPrimary),
        'Primary Total $/Hr': roundUp(cost.primary.totalHr),
        'Primary Monthly $': roundUp(cost.primary.totalHr * 730),
        'DR Status': cost.dr ? 'PROTECTED' : 'N/A',
        'DR ECPU': roundUp(ecpuDR),
        'DR Monthly $': cost.dr ? roundUp(cost.dr.totalHr * 730) : 0,
        'Total Annual Estimate $': roundUp(cost.totalHr * 730 * 12)
      };
    });

    const ws = XLSX.utils.json_to_sheet(costData);

    // Format currency columns and ensure numeric type
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      // Columns: Primary Total $/Hr (5), Primary Monthly $ (6), DR Monthly $ (9), Total Annual Estimate $ (10)
      [5, 6, 9, 10].forEach(C => {
        const cell = ws[XLSX.utils.encode_cell({ c: C, r: R })];
        if (cell && cell.t === 'n') {
          cell.z = "$#,##0.00";
        }
      });
    }

    // Append Assumptions at the bottom
    const lastRow = range.e.r;
    const assumptionsAOA = [
      [],
      ["ASSUMPTIONS & PRICING LOGIC"],
      ...getAssumptions().map(a => [a.title, a.desc])
    ];
    XLSX.utils.sheet_add_aoa(ws, assumptionsAOA, { origin: { r: lastRow + 2, c: 0 } });

    XLSX.utils.book_append_sheet(wb, ws, "Cost Analysis");

    // Sheet 2: Assumptions (Separated as requested before, but now also at bottom of Sheet 1)
    const assumptionData = getAssumptions().map(a => ({ Feature: a.title, Assumption: a.desc }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(assumptionData), "Assumptions Detailed");

    // Sheet 3: Infrastructure Details
    const infraDetails: any[] = [];
    const isManaged = settings.model === 'Base-DB' || settings.model === 'Autonomous-Serverless';
    
    if (isManaged) {
      filteredRacks.forEach(rack => {
        rack.clusters.forEach(cluster => {
          cluster.databases.forEach(db => {
            infraDetails.push({ 
              'Database Name': db.dbName, 
              'Cohort': db.cohort, 
              'vCPU': db.dbVcpu, 
              'Memory': `${db.dbMemoryMB} MB`, 
              'Storage': `${db.allocatedStorageGB} GB`,
              'Infrastructure': 'Managed'
            });
          });
        });
      });
    } else {
      filteredRacks.forEach(rack => {
        infraDetails.push({ Type: 'RACK', ID: rack.id, Cohort: rack.cohort, Nodes: rack.numDbServers, Cells: rack.numStorageServers });
        rack.clusters.forEach(cluster => {
          infraDetails.push({ Type: '  CLUSTER', ID: cluster.name, Memory: `${(cluster.totalMemoryMB/1024).toFixed(1)} GB`, Storage: `${cluster.totalAllocatedGB} GB` });
          cluster.databases.forEach(db => {
            infraDetails.push({ Type: '    DATABASE', ID: db.dbName, vCPU: db.dbVcpu, Memory: `${db.dbMemoryMB} MB`, Storage: `${db.allocatedStorageGB} GB` });
          });
        });
      });
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(infraDetails), "Infrastructure Details");

    XLSX.writeFile(wb, `Oracle_Cloud_Analysis_${settings.model}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const roundUp = (num: number) => (Math.ceil(num * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    
    // Page 1: Cost Summary
    doc.setFontSize(18);
    doc.text(`Inventory Analysis - ${settings.model}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Exported on: ${new Date().toLocaleDateString()}`, 14, 28);
    
    doc.text("Executive Summary of Costs", 14, 38);
    autoTable(doc, {
      startY: 42,
      head: [['DB Name', 'Cohort', 'Monthly ($)', 'Annual ($)']],
      body: filteredCosts.map(c => [
        c.dbName, 
        c.cohort, 
        roundUp(c.totalHr * 730), 
        roundUp(c.totalHr * 8760)
      ]),
      theme: 'grid'
    });

    // Assumptions Section
    const nextY = (doc as any).lastAutoTable.finalY + 15;
    doc.text("Model Assumptions", 14, nextY);
    autoTable(doc, {
      startY: nextY + 5,
      head: [['Feature', 'Assumption']],
      body: getAssumptions().map(a => [a.title, a.desc]),
      theme: 'plain',
      styles: { fontSize: 8 }
    });

    doc.addPage();
    // Page 2: Infrastructure
    const isManaged = settings.model === 'Base-DB' || settings.model === 'Autonomous-Serverless';
    doc.text(isManaged ? "Database Inventory (Managed Infrastructure)" : "Infrastructure Hierarchy (Racks > Clusters > DBs)", 14, 20);
    const pdfBody: any[] = [];
    
    if (isManaged) {
      filteredRacks.forEach(r => {
        r.clusters.forEach(c => {
          c.databases.forEach(db => {
            pdfBody.push([db.dbName, db.cohort, `${db.dbVcpu} vC`, `${db.allocatedStorageGB} GB`]);
          });
        });
      });
    } else {
      filteredRacks.forEach(r => {
        pdfBody.push([{ content: `RACK: ${r.id} (${r.cohort}) | Nodes: ${r.numDbServers} | Cells: ${r.numStorageServers}`, colSpan: 4, styles: { fillColor: [56, 189, 248], textColor: 255 } }]);
        r.clusters.forEach(c => {
          pdfBody.push([{ content: `  Cluster: ${c.name}`, colSpan: 4, styles: { fillColor: [240, 249, 255] } }]);
          c.databases.forEach(db => {
            pdfBody.push(['', `    ${db.dbName}`, `${db.dbVcpu} vC`, `${db.allocatedStorageGB} GB`]);
          });
        });
      });
    }

    autoTable(doc, {
      startY: 25,
      head: [['', 'Entity', 'Spec 1', 'Spec 2']],
      body: pdfBody,
      theme: 'plain',
      styles: { fontSize: 8 }
    });

    doc.save(`Oracle_Cloud_Analysis_${settings.model}.pdf`);
  };

  const addDbToFilter = (name: string) => {
    if (!selectedDbs.includes(name)) {
      setSelectedDbs([...selectedDbs, name]);
    }
    setDbSearch('');
    setShowSearchDropdown(false);
  };

  const removeDbFromFilter = (name: string) => {
    setSelectedDbs(selectedDbs.filter(n => n !== name));
  };

  return (
    <div className="space-y-10">
      {/* Global Filters & Export */}
      <div className="flex flex-col gap-6 bg-white/5 p-6 rounded-3xl border border-white/10 glass">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Box className="w-3 h-3" /> Infra Model
            </label>
            <select 
              value={settings.model}
              onChange={(e) => setSettings({ ...settings, model: e.target.value as InfraModel })}
              className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer w-[200px]"
            >
              <option value="ExaCS-Dedicated">ExaCS Dedicated</option>
              <option value="Autonomous-Dedicated">Autonomous Dedicated</option>
              <option value="Autonomous-Serverless">Autonomous Serverless</option>
              <option value="Base-DB">Base DB</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Filter className="w-3 h-3" /> Cohort
            </label>
            <select 
              value={cohortFilter}
              onChange={(e) => setCohortFilter(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              {cohorts.map(c => <option key={c} value={c}>{c === 'all' ? 'All Cohorts' : c}</option>)}
            </select>
          </div>

          <div className="space-y-2 flex-1 min-w-[300px] relative">
            <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Search className="w-3 h-3" /> Filter by Database or VM Cluster
            </label>
            <div className="flex flex-wrap gap-2 p-2 bg-slate-900/50 rounded-xl border border-white/10 min-h-[42px]">
              {selectedDbs.map(name => (
                <span 
                  key={name}
                  className="bg-sky-500/20 text-sky-400 px-2 py-1 rounded-lg text-[10px] font-bold border border-sky-500/30 flex items-center gap-2"
                >
                  {name}
                  <X 
                    className="w-3 h-3 cursor-pointer hover:text-white" 
                    onClick={() => removeDbFromFilter(name)}
                  />
                </span>
              ))}
              <input 
                type="text"
                value={dbSearch}
                onChange={(e) => {
                  setDbSearch(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onFocus={() => setShowSearchDropdown(true)}
                placeholder="Search resources..."
                className="bg-transparent border-none outline-none text-xs text-white placeholder-slate-600 flex-1 min-w-[120px]"
              />
            </div>
            {showSearchDropdown && dbSearch && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-white/10 rounded-xl z-[100] shadow-2xl max-h-[200px] overflow-y-auto">
                {filteredSearchList.map(item => (
                  <div 
                    key={`${item.type}-${item.name}`}
                    className="px-4 py-2 hover:bg-white/5 cursor-pointer text-xs transition-colors border-b border-white/5 last:border-none flex justify-between items-center"
                    onClick={() => addDbToFilter(item.name)}
                  >
                    <span>{item.name}</span>
                    <span className="text-[9px] font-mono text-slate-600 uppercase tracking-tighter">{item.type}</span>
                  </div>
                ))}
                {filteredSearchList.length === 0 && <div className="px-4 py-2 text-[10px] text-slate-500 italic">No matches...</div>}
              </div>
            )}
          </div>
          
          <div className="flex gap-4">
            <label 
              className="flex items-center gap-2 px-4 py-2 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-xl text-xs font-semibold hover:bg-sky-500/20 transition-all cursor-pointer"
              title="Upload Infrastructure Excel"
            >
              <Upload className="w-4 h-4" /> Upload Infra
              <input 
                type="file" 
                className="hidden" 
                accept=".xlsx, .xls, .csv" 
                onChange={handleInfrastructureUpload}
              />
            </label>
            <div className="flex gap-3">
              <button 
                onClick={exportExcel}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-semibold hover:bg-emerald-500/20 transition-all"
              >
                <Download className="w-4 h-4" /> XLSX
              </button>
              <button 
                onClick={exportPDF}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold hover:bg-red-500/20 transition-all"
              >
                <Download className="w-4 h-4" /> PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Top Level Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {settings.model !== 'Base-DB' && settings.model !== 'Autonomous-Serverless' && (
          <div className="glass-card p-4 flex flex-col justify-between min-h-[100px] border-sky-500/10">
            <p className="text-slate-500 text-[9px] font-mono uppercase tracking-widest font-semibold pb-2 mb-2 border-b border-white/5">DB / Storage Nodes</p>
            <div className="space-y-1">
              <p className="text-xl font-bold text-white">{stats.totalDbServers} / {stats.totalStorageServers}</p>
              <p className="text-[10px] text-slate-500 font-mono">Total Infrastructure</p>
            </div>
          </div>
        )}
        <div className="glass-card p-4 flex flex-col justify-between min-h-[100px]">
          <p className="text-slate-500 text-[9px] font-mono uppercase tracking-widest font-semibold flex items-center gap-2 border-b border-white/5 pb-2 mb-2">
            <DbIcon className="w-3 h-3 text-sky-400" /> DBs
          </p>
          <p className="text-xl font-bold text-white">{stats.totalDbs}</p>
        </div>
        <div className="glass-card p-4 flex flex-col justify-between min-h-[100px]">
          <p className="text-slate-500 text-[9px] font-mono uppercase tracking-widest font-semibold flex items-center gap-2 border-b border-white/5 pb-2 mb-2 text-nowrap">
            <HardDrive className="w-3 h-3 text-sky-400" /> Storage
          </p>
          <p className="text-xl font-bold text-white">{stats.totalStorageTB} <span className="text-[10px] text-slate-500 font-normal">TB</span></p>
        </div>
        <div className="glass-card p-4 flex flex-col justify-between min-h-[100px]">
          <p className="text-slate-500 text-[9px] font-mono uppercase tracking-widest font-semibold flex items-center gap-2 border-b border-white/5 pb-2 mb-2 text-nowrap">
            <LayersIcon className="w-3 h-3 text-sky-400" /> Memory
          </p>
          <p className="text-xl font-bold text-white">{stats.totalMemoryTB} <span className="text-[10px] text-slate-500 font-normal">TB</span></p>
        </div>
        <div className="glass-card p-4 flex flex-col justify-between min-h-[100px]">
          <p className="text-slate-500 text-[9px] font-mono uppercase tracking-widest font-semibold flex items-center gap-2 border-b border-white/5 pb-2 mb-2 text-nowrap">
            <Cpu className="w-3 h-3 text-sky-400" /> total ECPU
          </p>
          <p className="text-xl font-bold text-white">{stats.totalEcpu}</p>
          <p className="text-[8px] text-slate-500 font-mono italic">Incl. 3X Scaling Logic</p>
        </div>
        <div className="glass-card p-4 flex flex-col justify-between min-h-[100px]">
          <p className="text-slate-500 text-[9px] font-mono uppercase tracking-widest font-semibold flex items-center gap-2 border-b border-white/5 pb-2 mb-2">
            <HardDrive className="w-3 h-3 text-emerald-400" /> Backup Storage
          </p>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <p className="text-lg font-bold text-white">${stats.totalBackup.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              <p className="text-[10px] text-slate-500 font-mono">{(stats.totalBackupGB / 1024).toFixed(1)} TB</p>
            </div>
            <div className="flex flex-wrap gap-x-2 text-[8px] font-mono text-slate-500">
              {Object.entries(stats.cohortBreakdown).map(([cohort, data]) => {
                const breakdown = data as { backup: number; backupGB: number };
                return (
                  <span key={cohort}>{cohort.split(' ').map(w => w[0]).join('')}: ${breakdown.backup.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                );
              })}
            </div>
          </div>
        </div>
        <div className="glass p-4 flex flex-col justify-between min-h-[100px] border-emerald-500/20 bg-emerald-500/[0.02]">
          <p className="text-emerald-500/60 text-[9px] font-mono uppercase tracking-widest font-semibold border-b border-white/5 pb-2 mb-2">Estimated Costs</p>
          <div className="space-y-0.5">
            <p className="text-lg font-bold text-emerald-400">${stats.totalMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-[9px] font-normal text-slate-500">/mo</span></p>
            <p className="text-xs font-bold text-white">${stats.totalAnnual.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-[9px] font-normal text-slate-500">/yr</span></p>
          </div>
        </div>
      </div>

      <div className="glass rounded-3xl border border-white/10 overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-white/5 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs font-mono uppercase tracking-widest text-slate-300">Cohort Distribution Analytics (Breakdown)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/10 text-slate-500">
                <th className="px-6 py-3 font-mono uppercase">Cohort Name</th>
                <th className="px-6 py-3 font-mono uppercase text-right">Databases</th>
                <th className="px-6 py-3 font-mono uppercase text-right">ECPUs</th>
                <th className="px-6 py-3 font-mono uppercase text-right">Backup Storage</th>
                <th className="px-6 py-3 font-mono uppercase text-right">Memory (GB)</th>
                <th className="px-6 py-3 font-mono uppercase text-right">Storage (TB)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {Object.entries(stats.cohortBreakdown)
                .filter(([cohort]) => cohortFilter === 'all' || cohortFilter === cohort)
                .sort(([a], [b]) => {
                  // Custom sort: Production first, then DR, then others alphabetically
                  if (a === 'Production') return -1;
                  if (b === 'Production') return 1;
                  if (a === 'DR') return -1;
                  if (b === 'DR') return 1;
                  return a.localeCompare(b);
                })
                .map(([cohort, data]) => {
                const cData = data as { dbs: number; ecpu: number; backup: number; memory: number; storage: number; backupGB: number; storageCost: number; memoryCost: number };
                return (
                 <tr key={cohort} className={cohort === 'DR' ? 'bg-emerald-500/[0.03]' : 'hover:bg-white/[0.03]'}>
                   <td className="px-6 py-3 font-bold text-slate-200">
                     <span className={cohort === 'DR' ? 'text-emerald-400 italic' : ''}>{cohort}</span>
                   </td>
                   <td className="px-6 py-3 text-right text-slate-400">{cData.dbs}</td>
                   <td className="px-6 py-3 text-right">
                      <div className="flex flex-col">
                        <span className="text-sky-400 font-bold font-mono">{cData.ecpu.toFixed(1)}</span>
                        <span className="text-[9px] text-slate-500 font-mono">(${(cData.ecpu * settings.ecpuHr * 730).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo)</span>
                      </div>
                   </td>
                   <td className="px-6 py-3 text-right">
                      <div className="flex flex-col">
                        <span className="text-emerald-400 font-bold font-mono">{(cData.backupGB / 1024).toFixed(1)} TB</span>
                        <span className="text-[9px] text-slate-500 font-mono">(${cData.backup.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo)</span>
                      </div>
                   </td>
                   <td className="px-6 py-3 text-right">
                      <div className="flex flex-col">
                        <span className="text-slate-400 font-bold font-mono">{(cData.memory / 1024).toFixed(0)} GB</span>
                        <span className="text-[9px] text-slate-500 font-mono">(${cData.memoryCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo)</span>
                      </div>
                   </td>
                   <td className="px-6 py-3 text-right">
                      <div className="flex flex-col">
                        <span className="text-emerald-500/80 font-bold font-mono">{(cData.storage / 1024).toFixed(1)} TB</span>
                        <span className="text-[9px] text-slate-500 font-mono">(${cData.storageCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo)</span>
                      </div>
                   </td>
                 </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabs and Global Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1 bg-white/5 p-1 rounded-2xl w-fit border border-white/10 glass">
          {[
            { id: 'grouping', label: 'Logical View', icon: LayoutGrid },
            { id: 'infra', label: 'Infrastructure View', icon: Server },
            { id: 'pricing', label: 'Cost Analysis', icon: CircleDollarSign },
            { id: 'comparison', label: 'Comp Matrix', icon: BarChart2 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all relative ${
                activeTab === tab.id 
                  ? 'bg-sky-500 text-white shadow-[0_0_20px_rgba(56,189,248,0.3)]' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {(activeTab === 'grouping' || activeTab === 'infra') && (
          <button 
            onClick={() => setIsAllExpanded(!isAllExpanded)}
            className="text-[10px] font-mono uppercase tracking-widest text-sky-400 hover:text-white transition-colors bg-white/5 px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2"
          >
            {isAllExpanded ? <X className="w-3 h-3" /> : <Box className="w-3 h-3" />}
            {isAllExpanded ? 'Collapse All Sections' : 'Expand All Sections'}
          </button>
        )}
      </div>

      {/* View Wrapper */}
      <div className="relative">
        <AnimatePresence mode="wait">
          {activeTab === 'grouping' && (
            <motion.div
              key="grouping"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setIsSelectionMode(!isSelectionMode)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${isSelectionMode ? 'bg-sky-500 text-white border-sky-500' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'}`}
                    >
                      {isSelectionMode ? 'Cancel Selection' : 'Batch Delete'}
                    </button>
                    {isSelectionMode && selectedEntityIds.size > 0 && (
                      <button 
                        onClick={bulkDeleteSelected}
                        className="px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-[10px] font-bold hover:bg-red-500/20 transition-all flex items-center gap-2"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete ({selectedEntityIds.size})
                      </button>
                    )}
                  </div>
                  <div className="flex gap-3">
                    {workingRacks !== committedRacks && (
                      <>
                        <button 
                          onClick={discardChanges}
                          className="px-4 py-2 bg-white/5 text-slate-400 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 transition-all"
                        >
                          Discard Changes
                        </button>
                        <button 
                          onClick={triggerSaveSummary}
                          className="px-4 py-2 bg-sky-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-sky-500/20 hover:scale-105 active:scale-95 transition-all"
                        >
                          Save Configuration
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <GroupingView 
                   racks={filteredRacks} 
                   isAllExpanded={isAllExpanded} 
                   addRack={openAddRackModal}
                   addCluster={openAddClusterModal}
                   addDbToCluster={addDbToCluster}
                   allDatabases={databases}
                   isSelectionMode={isSelectionMode}
                   selectedIds={selectedEntityIds}
                   toggleSelection={toggleEntitySelection}
                   model={settings.model}
                />
              </DndContext>
            </motion.div>
          )}

          {activeTab === 'infra' && (
            <motion.div
              key="infra"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setIsSelectionMode(!isSelectionMode)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${isSelectionMode ? 'bg-sky-500 text-white border-sky-500' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'}`}
                    >
                      {isSelectionMode ? 'Cancel Selection' : 'Batch Delete'}
                    </button>
                    {isSelectionMode && selectedEntityIds.size > 0 && (
                      <button 
                        onClick={bulkDeleteSelected}
                        className="px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-[10px] font-bold hover:bg-red-500/20 transition-all flex items-center gap-2"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete ({selectedEntityIds.size})
                      </button>
                    )}
                  </div>
                  <div className="flex gap-3">
                    {workingRacks !== committedRacks && (
                      <>
                        <button 
                          onClick={discardChanges}
                          className="px-4 py-2 bg-white/5 text-slate-400 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 transition-all"
                        >
                          Discard Changes
                        </button>
                        <button 
                          onClick={triggerSaveSummary}
                          className="px-4 py-2 bg-sky-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-sky-500/20 hover:scale-105 active:scale-95 transition-all"
                        >
                          Save Configuration
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <InfrastructureView 
                  racks={filteredRacks} 
                  isAllExpanded={isAllExpanded} 
                  addRack={openAddRackModal}
                  addCluster={openAddClusterModal}
                  isSelectionMode={isSelectionMode}
                  selectedIds={selectedEntityIds}
                  toggleSelection={toggleEntitySelection}
                  model={settings.model}
                />
              </DndContext>
            </motion.div>
          )}

          {activeTab === 'pricing' && (
            <motion.div
              key="pricing"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <PricingView 
                costs={filteredCosts} 
                databases={databases}
                setDatabases={setDatabases}
                settings={settings} 
                setSettings={setSettings} 
              />
            </motion.div>
          )}

          {activeTab === 'comparison' && (
            <motion.div
              key="comparison"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ComparisonView 
                databases={databases}
                racks={racks}
                settings={settings}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modals */}
        <AnimatePresence>
          {isRackModalOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                onClick={() => setIsRackModalOpen(false)}
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="bg-slate-900 border border-white/10 rounded-3xl p-8 w-full max-w-md relative z-[100] shadow-2xl"
              >
                <h3 className="text-xl font-bold text-white mb-6">Create New Rack</h3>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Rack Name</label>
                    <input 
                      type="text" 
                      value={newRackName}
                      onChange={(e) => setNewRackName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:ring-1 focus:ring-sky-500"
                      placeholder="e.g. RACK-PRODUCTION-01"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Environment</label>
                    <select 
                      value={newRackCohort}
                      onChange={(e) => setNewRackCohort(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
                    >
                      <option value="Production">Production</option>
                      <option value="Non-Production">Non-Production</option>
                      <option value="UAT">UAT</option>
                      <option value="Sandbox">Sandbox</option>
                    </select>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => setIsRackModalOpen(false)}
                      className="flex-1 px-4 py-2 bg-white/5 text-white rounded-xl border border-white/10 font-bold hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={confirmAddRack}
                      className="flex-1 px-4 py-2 bg-sky-500 text-white rounded-xl font-bold shadow-lg shadow-sky-500/20 hover:scale-105 active:scale-95 transition-all"
                    >
                      Create Rack
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {isClusterModalOpen.isOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                onClick={() => setIsClusterModalOpen({ isOpen: false, rackId: '' })}
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="bg-slate-900 border border-white/10 rounded-3xl p-8 w-full max-w-md relative z-[100] shadow-2xl"
              >
                <h3 className="text-xl font-bold text-white mb-2">Add VM Cluster</h3>
                <p className="text-xs text-slate-500 mb-6 font-mono uppercase tracking-wider">
                  Rack: {isClusterModalOpen.rackId} | Environment: {workingRacks.find(r => r.id === isClusterModalOpen.rackId)?.cohort}
                </p>
                
                <div className="space-y-6">
                  <div className="flex gap-4 p-1 bg-white/5 rounded-xl border border-white/10 mb-6">
                    <button 
                      onClick={() => setIsExistingCluster(false)}
                      className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${!isExistingCluster ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                    >
                      New Cluster
                    </button>
                    <button 
                      onClick={() => setIsExistingCluster(true)}
                      className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${isExistingCluster ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                    >
                      Select Existing
                    </button>
                  </div>

                  {!isExistingCluster ? (
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Cluster Name</label>
                      <input 
                        type="text" 
                        value={newClusterName}
                        onChange={(e) => setNewClusterName(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:ring-1 focus:ring-sky-500"
                        placeholder="e.g. VM-CLUSTER-01"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Select Cluster</label>
                      <select 
                        value={selectedExistingCluster}
                        onChange={(e) => setSelectedExistingCluster(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
                      >
                        <option value="">Choose a cluster...</option>
                        {availableClustersForSelection.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => setIsClusterModalOpen({ isOpen: false, rackId: '' })}
                      className="flex-1 px-4 py-2 bg-white/5 text-white rounded-xl border border-white/10 font-bold hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={confirmAddCluster}
                      disabled={isExistingCluster && !selectedExistingCluster}
                      className="flex-1 px-4 py-2 bg-sky-500 text-white rounded-xl font-bold shadow-lg shadow-sky-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {isSaveModalOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                onClick={() => setIsSaveModalOpen(false)}
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="bg-slate-900 border border-white/10 rounded-3xl p-8 w-full max-w-2xl relative z-[100] shadow-2xl flex flex-col max-h-[80vh]"
              >
                <div className="flex items-center gap-3 mb-6">
                  <CircleDollarSign className="w-6 h-6 text-sky-400" />
                  <h3 className="text-xl font-bold text-white">Review Changes</h3>
                </div>
                
                <div className="flex-1 overflow-y-auto mb-8 pr-4 custom-scrollbar space-y-6">
                  {validationErrors.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-red-500 flex items-center gap-2">
                        <X className="w-3 h-3" /> Configuration Violations
                      </h4>
                      {validationErrors.map((error, i) => (
                        <div key={`err-${i}`} className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium">
                          {error}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-3">
                    <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                      Planned Transitions
                    </h4>
                    {changeLog.length > 0 ? (
                      changeLog.map((log, i) => (
                        <div key={i} className="flex gap-3 text-sm p-3 bg-white/5 rounded-xl border border-white/5 text-slate-300">
                          <span className="text-sky-400 font-mono text-[10px] pt-1">[{i+1}]</span>
                          {log}
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 text-center py-12 italic text-xs">No significant changes detected. Empty entities will be cleaned up.</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setIsSaveModalOpen(false)}
                    className="flex-1 px-6 py-3 bg-white/5 text-white rounded-xl border border-white/10 font-bold hover:bg-white/10 transition-all"
                  >
                    Discard & Exit
                  </button>
                  <button 
                    onClick={confirmSave}
                    disabled={validationErrors.length > 0}
                    className="flex-1 px-6 py-3 bg-sky-500 text-white rounded-xl font-bold shadow-lg shadow-sky-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                  >
                    Confirm & Save
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
