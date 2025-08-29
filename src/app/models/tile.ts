
export interface Tile {
  id: number;
  title: string;
  itemsRequired: number;
  itemsObtained: number;
  src: string;
  bossSrc: string;
  alt?: string;
  description?: string;
  completed?: boolean;
}