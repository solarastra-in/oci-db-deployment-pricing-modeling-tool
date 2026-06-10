export interface Database {
  id: string;
  cohort: string;
  dbName: string;
  allocatedStorageGB: number;
  usedStorageGB: number;
  dbVcpu: number;
  dbMemoryMB: number;
  clusterName: string;
  hasDr?: boolean;
}

export interface VMCluster {
  name: string;
  cohort: string;
  databases: Database[];
  totalMemoryMB: number;
  totalAllocatedGB: number;
  totalUsedGB: number;
  totalVcpu: number;
}

export interface Rack {
  id: string;
  cohort: string;
  isDr?: boolean;
  clusters: VMCluster[];
  numDbServers: number;
  numStorageServers: number;
  totalMemoryCapacityMB: number;
  totalStorageCapacityGB: number;
  
  // Aggregated usage
  actualMemoryUsageMB: number;
  actualStorageUsageGB: number;
}

export type InfraModel = 'ExaCS-Dedicated' | 'Autonomous-Dedicated' | 'Autonomous-Serverless' | 'Base-DB';

export interface DbCost {
  dbId: string;
  dbName: string;
  cohort: string;
  dbCohort: string; // The original database cohort for filtering
  model: InfraModel;
  primary: {
    dbServerCostHr: number;
    storageServerCostHr: number;
    ecpuCostHr: number;
    recoveryCostMonth: number;
    totalHr: number;
  };
  dr?: {
    dbServerCostHr: number;
    storageServerCostHr: number;
    ecpuCostHr: number;
    recoveryCostMonth: number;
    totalHr: number;
  };
  totalHr: number;
}

export interface PricingSettings {
  model: InfraModel;
  dbServerHr: number;
  storageServerHr: number;
  ecpuHr: number;
  recoveryGbMonth: number;
  drEcpuPercent: number;
  // SKU specific rates (Autonomous)
  dbStorageTpGbMonth: number; // SKU-B95706
  dbStorageGbMonth: number;   // SKU-B9554
  serverlessHighUtilPercent: number;
  serverlessHighTimePercent: number;
  serverlessLowUtilPercent: number;
  serverlessLowTimePercent: number;
  backupStorageGrowthPercent: number;
  // Base DB settings
  baseDbEcpuHr: number;
  baseDbStorageGbMonth: number;
}

export const DEFAULT_SETTINGS: PricingSettings = {
  model: 'ExaCS-Dedicated',
  dbServerHr: 2.9032,
  storageServerHr: 2.9032,
  ecpuHr: 0.0807,
  recoveryGbMonth: 0.04,
  drEcpuPercent: 20,
  dbStorageTpGbMonth: 0.1156,
  dbStorageGbMonth: 0.0244,
  serverlessHighUtilPercent: 66,
  serverlessHighTimePercent: 20,
  serverlessLowUtilPercent: 33,
  serverlessLowTimePercent: 80,
  backupStorageGrowthPercent: 0,
  baseDbEcpuHr: 0.0484,
  baseDbStorageGbMonth: 0.0595
};

export const CONSTANTS = {
  DB_SERVER_MEMORY_TB: 1.39,
  STORAGE_SERVER_GB: 88, // 88TB according to prompt "88TB usable storage space"
  DB_SERVER_MEMORY_MB: 1.39 * 1024 * 1024,
  MIN_DB_SERVERS: 2,
  MIN_STORAGE_SERVERS: 3,
  MAX_CLUSTERS_PER_RACK: 8,
  SKUS: {
    DB_SERVER: "B110627",
    STORAGE_SERVER: "B110629",
    ECPU: "B95704",
    STORAGE_TP: "B95706",
    STORAGE_AI: "B9554",
    RECOVERY: "B88847",
    BASE_DB_STORAGE: "B111584",
    BASE_DB_ECPU: "B111588"
  }
};
