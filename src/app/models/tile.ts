
export interface Tile {
  id: number;
  title: string;
  itemsRequired: number;
  itemsObtained: number;
  src: string;
  bossSrc: string;
  points: number;
  alt?: string;
  description?: string;
  rules:string[]
}