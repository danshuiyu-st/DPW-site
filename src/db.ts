import Dexie, { Table } from 'dexie';

export interface WaferProject {
  id?: number;
  name: string;
  folderPath: string; // "Owner/Product/Variant"
  
  // Metadata for searching/displaying
  owner: string;
  product: string;
  variant: string;
  
  updatedAt: number;
  thumbnail: string; // Base64 image
  
  // Quick stats for dashboard
  meta: {
    waferSize: string;
    waferType: string;
    mode: string;
    dieSize: string;
    exclusion: string;
    goodDie: number;
    yield: string;
  };

  // Full application state
  state: any;
}

class WaferDatabase extends Dexie {
  projects!: Table<WaferProject, number>;

  constructor() {
    super('WaferMapProDB');
    (this as any).version(1).stores({
      projects: '++id, name, folderPath, owner, product, variant, updatedAt'
    });
  }
}

export const db = new WaferDatabase();