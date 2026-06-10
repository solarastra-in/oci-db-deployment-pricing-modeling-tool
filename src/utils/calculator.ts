import { Database, VMCluster, Rack, CONSTANTS, DbCost, PricingSettings } from '../types';

export function processExcelData(rawData: any[]): Database[] {
  return rawData.map((row, index) => ({
    id: `db-${index}`,
    cohort: String(row['Cohort'] || '').trim(),
    dbName: String(row['DB Name'] || '').trim(),
    allocatedStorageGB: Number(row['Allocated Storage (GB)'] || 0),
    usedStorageGB: Number(row['Used Storage (GB)'] || 0),
    dbVcpu: Number(row['DB vCPU'] || 0),
    dbMemoryMB: Number(row['DB Memory (MB)'] || 0),
    clusterName: String(row['Cluster Name'] || '').trim(),
  }));
}

export function groupIntoRacks(databases: Database[]): Rack[] {
  const clustersMap = new Map<string, VMCluster>();
  
  databases.forEach(db => {
    const key = `${db.cohort}-${db.clusterName}`;
    if (!clustersMap.has(key)) {
      clustersMap.set(key, {
        name: db.clusterName,
        cohort: db.cohort,
        databases: [],
        totalMemoryMB: 0,
        totalAllocatedGB: 0,
        totalUsedGB: 0,
        totalVcpu: 0
      });
    }
    const cluster = clustersMap.get(key)!;
    cluster.databases.push(db);
    cluster.totalMemoryMB += db.dbMemoryMB;
    cluster.totalAllocatedGB += db.allocatedStorageGB;
    cluster.totalUsedGB += db.usedStorageGB;
    cluster.totalVcpu += db.dbVcpu;
  });

  const allClusters = Array.from(clustersMap.values());
  const racks: Rack[] = [];

  const isNonProd = (cohort: string) => {
    const low = cohort.toLowerCase();
    return low.includes('dev') || low.includes('test') || low.includes('stage') || low.includes('stg') || low.includes('non-prod');
  };

  const cohorts = Array.from(new Set(allClusters.map(c => c.cohort)));
  const prodCohorts = cohorts.filter(c => !isNonProd(c));
  const nonProdClusters = allClusters.filter(c => isNonProd(c.cohort));

  let prodRackCount = 0;
  let nonProdRackCount = 0;
  let drRackCount = 0;

  // Finalize rack helper
  const createRack = (clusters: VMCluster[], cohortName: string, isDr = false) => {
    if (clusters.length === 0) return null;
    
    const totalMem = clusters.reduce((acc, c) => acc + c.totalMemoryMB, 0);
    const totalStorage = clusters.reduce((acc, c) => acc + c.totalAllocatedGB, 0);
    
    const neededDbServers = Math.ceil(totalMem / CONSTANTS.DB_SERVER_MEMORY_MB);
    const neededStorageServers = Math.ceil(totalStorage / (CONSTANTS.STORAGE_SERVER_GB * 1024));

    const finalDbServers = Math.max(CONSTANTS.MIN_DB_SERVERS, neededDbServers);
    const finalStorageServers = Math.max(CONSTANTS.MIN_STORAGE_SERVERS, neededStorageServers);

    let rackId = '';
    const isNP = cohortName === 'Non-Production';

    if (isDr) {
      drRackCount++;
      rackId = `RACK-DR-${drRackCount}`;
    } else if (isNP) {
      nonProdRackCount++;
      rackId = `RACK-NP-${nonProdRackCount}`;
    } else {
      prodRackCount++;
      rackId = `RACK-PR-${prodRackCount}`;
    }

    const rack: Rack = {
      id: rackId,
      cohort: cohortName,
      isDr,
      clusters: JSON.parse(JSON.stringify(clusters)),
      numDbServers: finalDbServers,
      numStorageServers: finalStorageServers,
      totalMemoryCapacityMB: finalDbServers * CONSTANTS.DB_SERVER_MEMORY_MB,
      totalStorageCapacityGB: finalStorageServers * CONSTANTS.STORAGE_SERVER_GB * 1024,
      actualMemoryUsageMB: totalMem,
      actualStorageUsageGB: totalStorage
    };
    
    return rack;
  };

  const primaryRacks: Rack[] = [];
  const drRacks: Rack[] = [];

  // Handle Prod Cohorts
  prodCohorts.forEach(cohortName => {
    const cohortClusters = allClusters.filter(c => c.cohort === cohortName);
    let currentRackClusters: VMCluster[] = [];
    
    cohortClusters.sort((a, b) => a.name.localeCompare(b.name));

    cohortClusters.forEach(cluster => {
      if (currentRackClusters.length < CONSTANTS.MAX_CLUSTERS_PER_RACK) {
        currentRackClusters.push(cluster);
      } else {
        const pr = createRack(currentRackClusters, cohortName);
        if (pr) primaryRacks.push(pr);
        const dr = createRack(currentRackClusters, cohortName, true);
        if (dr) drRacks.push(dr);
        currentRackClusters = [cluster];
      }
    });

    if (currentRackClusters.length > 0) {
      const pr = createRack(currentRackClusters, cohortName);
      if (pr) primaryRacks.push(pr);
      const dr = createRack(currentRackClusters, cohortName, true);
      if (dr) drRacks.push(dr);
    }
  });

  // Handle Non-Prod consolidation
  if (nonProdClusters.length > 0) {
    const npRack = createRack(nonProdClusters, 'Non-Production');
    if (npRack) primaryRacks.push(npRack);
  }

  // Final Combine: Prod -> NP -> DR
  // Renumber DR racks to start after primary ones
  const totalPrimary = primaryRacks.length;
  drRacks.forEach((dr, idx) => {
    dr.id = `RACK-DR-${totalPrimary + idx + 1}`;
  });

  return [...primaryRacks, ...drRacks];
}

export function refreshClusterStats(cluster: VMCluster): VMCluster {
  const totalMem = cluster.databases.reduce((acc, db) => acc + db.dbMemoryMB, 0);
  const totalAllocated = cluster.databases.reduce((acc, db) => acc + db.allocatedStorageGB, 0);
  const totalUsed = cluster.databases.reduce((acc, db) => acc + db.usedStorageGB, 0);
  const totalVcpu = cluster.databases.reduce((acc, db) => acc + db.dbVcpu, 0);
  
  return {
    ...cluster,
    totalMemoryMB: totalMem,
    totalAllocatedGB: totalAllocated,
    totalUsedGB: totalUsed,
    totalVcpu: totalVcpu
  };
}

export function refreshRackStats(rack: Rack): Rack {
  const totalMem = rack.clusters.reduce((acc, c) => acc + c.totalMemoryMB, 0);
  const totalStorage = rack.clusters.reduce((acc, c) => acc + c.totalAllocatedGB, 0);
  
  const neededDbServers = Math.ceil(totalMem / CONSTANTS.DB_SERVER_MEMORY_MB);
  const neededStorageServers = Math.ceil(totalStorage / (CONSTANTS.STORAGE_SERVER_GB * 1024));

  const finalDbServers = Math.max(CONSTANTS.MIN_DB_SERVERS, neededDbServers);
  const finalStorageServers = Math.max(CONSTANTS.MIN_STORAGE_SERVERS, neededStorageServers);

  return {
    ...rack,
    numDbServers: finalDbServers,
    numStorageServers: finalStorageServers,
    totalMemoryCapacityMB: finalDbServers * CONSTANTS.DB_SERVER_MEMORY_MB,
    totalStorageCapacityGB: finalStorageServers * CONSTANTS.STORAGE_SERVER_GB * 1024,
    actualMemoryUsageMB: totalMem,
    actualStorageUsageGB: totalStorage
  };
}

export function calculateCosts(racks: Rack[], settings: PricingSettings): DbCost[] {
  const costs: DbCost[] = [];

  racks.forEach(rack => {
    if (rack.isDr) return;

    const totalRackDbServerHr = rack.numDbServers * settings.dbServerHr;
    const totalRackStorageServerHr = rack.numStorageServers * settings.storageServerHr;
    const totalRackMemory = rack.actualMemoryUsageMB;
    const totalRackAllocated = rack.actualStorageUsageGB;

    rack.clusters.forEach(cluster => {
      cluster.databases.forEach(db => {
        let dbServerCost = 0;
        let storageServerCost = 0;
        let ecpuCostPrimary = 0;
        const growthFactor = 1 + (settings.backupStorageGrowthPercent / 100);
        let recoveryCostMonth = db.usedStorageGB * growthFactor * settings.recoveryGbMonth;

        if (settings.model === 'Base-DB') {
          // ECPU count = ROUNDUP(MAX(4, vCPU*2, MemoryMB/1024/2)/4,0)*4
          const ecpuMax = Math.max(4, db.dbVcpu * 2, db.dbMemoryMB / 1024 / 2);
          const effectiveEcpus = Math.ceil(ecpuMax / 4) * 4;
          ecpuCostPrimary = effectiveEcpus * settings.baseDbEcpuHr;

          // Storage logic Tiered
          const storageOptions = [256, 512, 1024, 2048, 4096, 8192, 16384, 24576, 32768, 40960];
          let storageNeeded = 0;
          
          const findStorageTier = (val: number) => {
            const tier = storageOptions.find(opt => opt >= val);
            return tier !== undefined ? tier : 40960;
          };

          if (db.allocatedStorageGB <= 40960) {
            storageNeeded = findStorageTier(db.allocatedStorageGB);
          } else if (db.usedStorageGB <= 40960) {
            storageNeeded = findStorageTier(db.usedStorageGB);
          } else {
            storageNeeded = 40960;
          }

          // Charge for SKU B111584: (Storage Needed * 1.25) + 205 GB
          const billableStorageGB = (storageNeeded * 1.25) + 205;
          storageServerCost = (billableStorageGB * settings.baseDbStorageGbMonth) / 730;
          
          dbServerCost = 0;
          
          // Autonomous Recovery Service: Based on Used Storage (GB)
          recoveryCostMonth = db.usedStorageGB * settings.recoveryGbMonth;
        } else if (settings.model === 'Autonomous-Serverless') {
          const isDR = db.cohort === 'DR' || db.cohort.toLowerCase() === 'dr';
          if (isDR) {
            recoveryCostMonth = 0;
          } else {
            // Using AI DB Storage $/GB (B9554)
            recoveryCostMonth = db.usedStorageGB * growthFactor * settings.dbStorageGbMonth;
          }
        }

        // Skip traditional infra partitioning if Base-DB
        if (settings.model !== 'Base-DB') {
          // Base ECPU calculation (1 vCPU = 2 ECPUs, rounded up to nearest whole number)
          let baseEcpus = Math.ceil(db.dbVcpu * 2);
          if (settings.model.startsWith('Autonomous')) {
            baseEcpus = Math.max(2, baseEcpus);
          }

          if (settings.model.startsWith('Autonomous')) {
            const ecpuBaseline = db.dbVcpu * 2;
            const lowUtil = settings.serverlessLowUtilPercent / 100;
            const lowTime = settings.serverlessLowTimePercent / 100;
            const highUtil = settings.serverlessHighUtilPercent / 100;
            const highTime = settings.serverlessHighTimePercent / 100;
            
            const weightedEcpus = (lowUtil * ecpuBaseline * lowTime) + (highUtil * ecpuBaseline * highTime);
            const effectiveEcpus = Math.ceil(Math.max(2, weightedEcpus));
            ecpuCostPrimary = effectiveEcpus * settings.ecpuHr;
            
            if (settings.model === 'Autonomous-Serverless') {
              const isProd = db.cohort === 'Production' || db.cohort.toLowerCase() === 'production' || rack.cohort === 'Production' || rack.cohort.toLowerCase() === 'production';
              
              // SKU B95706: AI DB Storage for TP. 
              // Prod gets 2x Allocated Storage, others get 1x.
              const multiplierTP = isProd ? 2 : 1;
              const storageServiceCostHr = (db.allocatedStorageGB * multiplierTP * settings.dbStorageTpGbMonth) / 730;

              storageServerCost = storageServiceCostHr;
              dbServerCost = 0;
            } else {
              // Dedicated adds infra cost (same as ExaCS)
              dbServerCost = totalRackMemory > 0 ? (db.dbMemoryMB / totalRackMemory) * totalRackDbServerHr : 0;
              storageServerCost = totalRackAllocated > 0 ? (db.allocatedStorageGB / totalRackAllocated) * totalRackStorageServerHr : 0;
            }
          } else {
            // ExaCS Dedicated
            dbServerCost = totalRackMemory > 0 ? (db.dbMemoryMB / totalRackMemory) * totalRackDbServerHr : 0;
            storageServerCost = totalRackAllocated > 0 ? (db.allocatedStorageGB / totalRackAllocated) * totalRackStorageServerHr : 0;
            ecpuCostPrimary = baseEcpus * settings.ecpuHr;
          }
        }

        const primaryTotalHr = dbServerCost + storageServerCost + ecpuCostPrimary + (recoveryCostMonth / 730);

        const costEntry: DbCost = {
          dbId: db.id,
          dbName: db.dbName,
          cohort: (settings.model === 'Base-DB') ? 'Managed' : rack.cohort,
          dbCohort: db.cohort,
          model: settings.model,
          primary: {
            dbServerCostHr: dbServerCost,
            storageServerCostHr: storageServerCost,
            ecpuCostHr: ecpuCostPrimary,
            recoveryCostMonth: recoveryCostMonth,
            totalHr: primaryTotalHr
          },
          totalHr: primaryTotalHr
        };

        // DR exists for Production cohort dbs
        const isProdCohort = rack.cohort === 'Production' || rack.cohort.toLowerCase() === 'production' || db.cohort.toLowerCase() === 'production';
        if (isProdCohort && db.hasDr !== false) {
          let drTotalHr = 0;
          let ecpuCostDR = 0;
          let storageServerCostDR = 0;
          let drRecoveryCost = 0;

          if (settings.model === 'Base-DB') {
            ecpuCostDR = ecpuCostPrimary;
            storageServerCostDR = storageServerCost;
            drRecoveryCost = recoveryCostMonth; 
          } else if (settings.model.startsWith('Autonomous')) {
            // DR size for Autonomous matches Production size (100% capacity)
            ecpuCostDR = ecpuCostPrimary;
            
            if (settings.model === 'Autonomous-Serverless') {
              // DR Cohort Storage is 1x Allocated Storage using SKU B95706 (TP)
              storageServerCostDR = (db.allocatedStorageGB * 1 * settings.dbStorageTpGbMonth) / 730;
              drRecoveryCost = 0;
            } else {
              // Dedicated adds infra cost (same as ExaCS)
              storageServerCostDR = totalRackAllocated > 0 ? (db.allocatedStorageGB / totalRackAllocated) * totalRackStorageServerHr : 0;
              drRecoveryCost = recoveryCostMonth;
            }
          } else {
            let baseEcpus = Math.ceil(db.dbVcpu * 2);
            const effectiveEcpusDR = baseEcpus * (settings.drEcpuPercent / 100);
            ecpuCostDR = effectiveEcpusDR * settings.ecpuHr;
            storageServerCostDR = totalRackAllocated > 0 ? (db.allocatedStorageGB / totalRackAllocated) * totalRackStorageServerHr : 0;
            drRecoveryCost = recoveryCostMonth;
          }

          drTotalHr = (settings.model === 'Autonomous-Serverless' ? 0 : dbServerCost) + storageServerCostDR + ecpuCostDR + (drRecoveryCost / 730);

          costEntry.dr = {
            dbServerCostHr: (settings.model === 'Autonomous-Serverless' || settings.model === 'Base-DB') ? 0 : dbServerCost,
            storageServerCostHr: storageServerCostDR,
            ecpuCostHr: ecpuCostDR,
            recoveryCostMonth: drRecoveryCost,
            totalHr: drTotalHr
          };
          costEntry.totalHr += drTotalHr;
        }

        costs.push(costEntry);
      });
    });
  });

  return costs;
}
