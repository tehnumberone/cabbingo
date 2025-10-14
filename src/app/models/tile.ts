
export interface Tile {
  id: number;
  title: string;
  conditions: {
    amount: number, type: string,
    progress: { name: string, obtained: number }[]
  };
  tileImg: string;
  bossSrc: string;
  points: number;
  description?: string;
  rules: string[];
}