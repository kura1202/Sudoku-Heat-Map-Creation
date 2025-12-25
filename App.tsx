import React, { useState, useMemo } from 'react';
import { SudokuGrid } from './components/SudokuGrid';
import { SudokuGridType, SudokuCell, AnalysisResult } from './types';
import { EXAMPLE_PUZZLE_STRINGS } from './constants';
import { validateGrid } from './utils/validator';
import { Header } from './components/Header';
import { Controls } from './components/Controls';
import { StatusMessage } from './components/StatusMessage';
import { analyzePatternsWithGemini } from './services/geminiService';
import { AddPuzzleModal } from './components/AddPuzzleModal';

const App: React.FC = () => {
  const [puzzles, setPuzzles] = useState<SudokuGridType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('分析するパズルを追加してください。');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [geminiAnalysis, setGeminiAnalysis] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const canAnalyze = useMemo(() => puzzles.length >= 2, [puzzles]);

  const performLocalAnalysis = (currentPuzzles: SudokuGridType[]): AnalysisResult => {
    const newAnalysis: AnalysisResult = Array(9).fill(null).map(() => Array(9).fill(null));
    const puzzleCount = currentPuzzles.length;

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const frequencies: { [key: number]: number } = {};
        for (const puzzle of currentPuzzles) {
          const num = puzzle[row][col];
          if (num !== null) {
            frequencies[num] = (frequencies[num] || 0) + 1;
          }
        }

        let mostFrequent: number | null = null;
        let maxFreq = 0;
        for (const num in frequencies) {
          if (frequencies[num] > maxFreq) {
            maxFreq = frequencies[num];
            mostFrequent = parseInt(num);
          }
        }
        
        const filledCount = Object.values(frequencies).reduce((a, b) => a + b, 0);

        newAnalysis[row][col] = {
          frequencies,
          mostFrequent,
          confidence: puzzleCount > 0 ? filledCount / puzzleCount : 0,
        };
      }
    }
    return newAnalysis;
  };

  const handleAnalyze = async () => {
    if (!canAnalyze) {
      setStatusMessage('分析するには少なくとも2つのパズルが必要です。');
      return;
    }
    setIsLoading(true);
    setStatusMessage('ローカルで頻度分析を実行中...');
    setAnalysisResult(null);
    setGeminiAnalysis('');

    await new Promise(resolve => setTimeout(resolve, 50));
    const localResult = performLocalAnalysis(puzzles);
    setAnalysisResult(localResult);

    try {
      setStatusMessage('Gemini AIがパターンを分析中...');
      const geminiReport = await analyzePatternsWithGemini(puzzles);
      setGeminiAnalysis(geminiReport);
      setStatusMessage('分析が完了しました。');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatusMessage(`エラー: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAll = () => {
    setPuzzles([]);
    setAnalysisResult(null);
    setGeminiAnalysis('');
    setStatusMessage('分析するパズルを追加してください。');
  };

  const parseAndValidatePuzzle = (puzzleString: string): { grid: SudokuGridType | null; error: string | null } => {
    const cleanedString = puzzleString.trim().replace(/\s+/g, '');
    if (cleanedString.length !== 81) {
      return { grid: null, error: `無効な長さです。81文字必要ですが、${cleanedString.length}文字でした。` };
    }
    if (!/^[1-9\.]+$/.test(cleanedString)) {
      return { grid: null, error: '無効な文字が含まれています。1-9の数字と `.` のみ使用できます。' };
    }

    const newGrid: SudokuGridType = Array(9).fill(null).map(() => Array(9).fill(null));
    for (let i = 0; i < 81; i++) {
      const char = cleanedString[i];
      const row = Math.floor(i / 9);
      const col = i % 9;
      newGrid[row][col] = char === '.' ? null : parseInt(char, 10) as SudokuCell;
    }

    if (!validateGrid(newGrid).isValid) {
      return { grid: null, error: 'このパズルは初期配置が数独のルールに違反しています。' };
    }
    
    return { grid: newGrid, error: null };
  };

  const handleLoadExamples = async () => {
    setIsLoading(true);
    setStatusMessage('サンプルパズルを読込中...');
    await new Promise(resolve => setTimeout(resolve, 50));

    const loadedPuzzles: SudokuGridType[] = [];
    for (const puzzleString of EXAMPLE_PUZZLE_STRINGS) {
      const { grid } = parseAndValidatePuzzle(puzzleString);
      if (grid) {
        loadedPuzzles.push(grid);
      }
    }
    setPuzzles(loadedPuzzles);
    setAnalysisResult(null);
    setGeminiAnalysis('');
    setStatusMessage(`${loadedPuzzles.length}個のサンプルパズルを読み込みました。「分析」ボタンを押してください。`);
    setIsLoading(false);
  };

  const handleAddPuzzle = async (puzzleString: string): Promise<string | null> => {
    const { grid, error } = parseAndValidatePuzzle(puzzleString);

    if (error) {
      return error;
    }
    if (grid) {
      setPuzzles(prev => [...prev, grid]);
      setStatusMessage(`パズルを追加しました。合計: ${puzzles.length + 1}個`);
      return null;
    }
    return "不明なエラーが発生しました。";
  };

  return (
    <>
      <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 font-sans">
        <div className="w-full max-w-5xl mx-auto bg-white rounded-2xl shadow-xl p-6 md:p-8">
          <Header />
          <main className="mt-6">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="flex flex-col">
                <h2 className="text-xl font-bold text-gray-800 mb-4">分析ヒートマップ</h2>
                <SudokuGrid analysisResult={analysisResult} />
                <p className="mt-4 text-sm text-gray-600">
                  各セルの色は、そのマスに数字が配置されている頻度（確信度）を表します。色が濃いほど、そのマスが空欄でない傾向が強いことを示します。セルにカーソルを合わせると詳細な頻度データが表示されます。
                </p>
              </div>

              {/* Right Column */}
              <div>
                <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-lg text-gray-800">分析コントローラー</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        現在 <span className="font-bold text-sky-600">{puzzles.length}</span> 個のパズルが読み込まれています。
                    </p>
                    <Controls 
                        isLoading={isLoading}
                        canAnalyze={canAnalyze}
                        onAnalyze={handleAnalyze}
                        onClearAll={handleClearAll}
                        onLoadExamples={handleLoadExamples}
                        onAddPuzzle={() => setIsModalOpen(true)}
                    />
                </div>
                
                <StatusMessage message={statusMessage} />

                {geminiAnalysis && (
                  <div className="mt-6 animate-fade-in">
                    <h3 className="font-bold text-lg text-gray-800 mb-2">GeminiによるAI分析レポート</h3>
                    <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                      {geminiAnalysis}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
        <footer className="text-center mt-8 text-gray-500 text-sm">
          <p>数独問題パターン解析 &copy; 2024</p>
        </footer>
      </div>
      <AddPuzzleModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddPuzzle}
      />
    </>
  );
};

export default App;