export type SudokuCell = number | null;
export type SudokuGridType = SudokuCell[][];

export interface CellAnalysis {
  frequencies: { [key: number]: number }; // e.g. {1: 5, 2: 2, ...}
  mostFrequent: number | null;
  confidence: number; // 0 to 1
}

export type AnalysisResult = (CellAnalysis | null)[][];
