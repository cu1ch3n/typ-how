import { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Check, X as CrossIcon, RotateCcw, GripVertical, Table2, Undo2, Search, Lightbulb, LayoutGrid, Binary, Code, Minus, Maximize2, SquareSplitHorizontal } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import { useAlgorithms } from '@/contexts/AlgorithmContext';
import { wasmInference } from '@/lib/wasmInterface';
import { KaTeXRenderer } from '@/components/KaTeXRenderer';
import { ExpressionHistory } from '@/components/ExpressionHistory';
import { Navbar } from '@/components/Navbar';
import { DerivationModal } from '@/components/DerivationModal';
import { CompareShareExportButtons } from '@/components/CompareShareExportButtons';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ImperativePanelHandle } from 'react-resizable-panels';

import { SideBySideComparison } from '@/components/SideBySideComparison';
// Import compare utilities - access functions with bracket notation
import { cleanUrl } from '@/lib/shareUtils';
import { useToast } from '@/hooks/use-toast';

import { AlgorithmSelector } from '@/components/AlgorithmSelector';

import { InferenceResult } from '@/types/inference';

interface ComparisonCell {
  algorithmId: string;
  expression: string;
  result?: InferenceResult;
  loading: boolean;
}

// Sortable Algorithm Badge Component
const SortableAlgorithmBadge = ({ algorithmId, algorithm, onRemove }: { 
  algorithmId: string; 
  algorithm: any; 
  onRemove: (id: string) => void; 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: algorithmId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Badge 
        variant="secondary" 
        className={`flex items-center gap-1 cursor-move select-none transition-all duration-200 ${
          isDragging ? 'scale-95 shadow-lg' : ''
        }`}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" {...listeners} />
        {algorithm?.Name || algorithmId}
        <X 
          className="h-3 w-3 cursor-pointer hover:text-destructive" 
          onClick={(e) => {
            e.stopPropagation();
            onRemove(algorithmId);
          }}
        />
      </Badge>
    </div>
  );
};

// Sortable Expression Item Component
const SortableExpressionItem = ({ expression, onRemove }: { 
  expression: string; 
  onRemove: (expr: string) => void; 
}) => {
  const { toast } = useToast();
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: expression });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleCopyExpression = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(expression);
      toast({
        description: "Expression copied to clipboard",
        duration: 2000,
      });
    } catch (error) {
      toast({
        description: "Failed to copy expression",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`flex items-center gap-1 px-2 py-1 border rounded cursor-move select-none transition-all duration-200 ${
        isDragging ? 'scale-95 shadow-lg' : ''
      }`}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" {...listeners} />
      <code 
        className="flex-1 text-xs font-code cursor-pointer hover:bg-accent/50 px-1 py-0.5 rounded transition-colors"
        onClick={handleCopyExpression}
      >
        {expression}
      </code>
      <X 
        className="h-3 w-3 cursor-pointer hover:text-destructive flex-shrink-0" 
        onClick={(e) => {
          e.stopPropagation();
          onRemove(expression);
        }}
      />
    </div>
  );
};

export const Compare = () => {
  const [selectedAlgorithms, setSelectedAlgorithms] = useState<string[]>([]);
  const [expressions, setExpressions] = useState<string[]>([]);
  const [newExpression, setNewExpression] = useState('');
  const [algorithmSearch, setAlgorithmSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'sidebyside'>('table');
  const [comparisonResults, setComparisonResults] = useState<Map<string, ComparisonCell>>(new Map());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{algorithmId: string; expression: string; result?: InferenceResult} | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { algorithms, loading, error } = useAlgorithms();

  // Panel collapse states
  const [algorithmsCollapsed, setAlgorithmsCollapsed] = useState(false);
  const [expressionCollapsed, setExpressionCollapsed] = useState(false);
  
  // Mobile tab state
  const [activeTab, setActiveTab] = useState('algorithms');
  const isMobile = useIsMobile();
  
  // Panel refs
  const algorithmsRef = useRef<ImperativePanelHandle>(null);
  const expressionRef = useRef<ImperativePanelHandle>(null);

  // Panel collapse handlers
  const handleCollapseAlgorithms = () => {
    algorithmsRef.current?.collapse();
    setAlgorithmsCollapsed(true);
  };

  const handleExpandAlgorithms = () => {
    algorithmsRef.current?.expand();
    setAlgorithmsCollapsed(false);
  };

  const handleCollapseExpression = () => {
    expressionRef.current?.collapse();
    setExpressionCollapsed(true);
  };

  const handleExpandExpression = () => {
    expressionRef.current?.expand();
    setExpressionCollapsed(false);
  };

  // Configure sensors for both mouse and touch
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load shared state from URL on mount, or set defaults
  useEffect(() => {
    // Only process URL params after algorithms are loaded
    if (loading || algorithms.length === 0) return;
    
    // Parse URL for shared comparison state
    const url = new URL(window.location.href);
    const algorithmsParam = url.searchParams.get('algorithms');
    const expressionsParam = url.searchParams.get('expressions');
    
    const sharedAlgorithms = algorithmsParam ? algorithmsParam.split(',') : [];
    const sharedExpressions = expressionsParam ? 
      expressionsParam.split(',').map(expr => decodeURIComponent(expr)) : [];
    
    if (sharedAlgorithms.length > 0 || sharedExpressions.length > 0) {
      // Validate algorithms exist
      const validAlgorithms = sharedAlgorithms.filter(id => 
        algorithms?.some(alg => alg.Id === id)
      );
      
      if (validAlgorithms.length > 0) {
        setSelectedAlgorithms(validAlgorithms);
      }
      
      if (sharedExpressions.length > 0) {
        setExpressions(sharedExpressions);
      }
      
      // Clean URL after loading
      cleanUrl();
    } else {
      // Set defaults when no URL params exist
      // Select first two algorithms if available
      if (algorithms.length >= 2) {
        setSelectedAlgorithms([algorithms[0].Id, algorithms[1].Id]);
      } else if (algorithms.length === 1) {
        setSelectedAlgorithms([algorithms[0].Id]);
      }
      
      // Set default expressions
      setExpressions(['\\x. x', '(\\x. x) 1']);
    }
  }, [algorithms, loading]);

  const getCellKey = (algorithmId: string, expression: string) => `${algorithmId}:${expression}`;

  const runComparison = useCallback(async (algorithmId: string, expression: string) => {
    const key = getCellKey(algorithmId, expression);
    
    setComparisonResults(prev => new Map(prev.set(key, {
      algorithmId,
      expression,
      loading: true
    })));

    try {
      const wasmResult = await wasmInference.runInference({
        algorithm: algorithmId,
        variant: undefined, // No variant support in compare mode for now
        expression,
        options: { showSteps: true, maxDepth: 100 }
      });
      
      if (!wasmResult.success || !wasmResult.result) {
        throw new Error(wasmResult.error || 'WASM inference failed');
      }
      
      const result = wasmResult.result as any;
      const inferenceResult = {
        success: result.success || false,
        finalType: result.finalType,
        derivation: result.derivation || [],
        error: result.error,
        errorLatex: result.errorLatex || false
      };
      setComparisonResults(prev => new Map(prev.set(key, {
        algorithmId,
        expression,
        result: inferenceResult,
        loading: false
      })));
    } catch (error) {
      setComparisonResults(prev => new Map(prev.set(key, {
        algorithmId,
        expression,
        result: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          derivation: []
        },
        loading: false
      })));
    }
  }, []);

  const runAllComparisons = useCallback(async () => {
    for (const algorithmId of selectedAlgorithms) {
      for (const expression of expressions) {
        await runComparison(algorithmId, expression);
      }
    }
  }, [selectedAlgorithms, expressions, runComparison]);

  const addAlgorithm = (algorithmId: string) => {
    if (!selectedAlgorithms.includes(algorithmId)) {
      setSelectedAlgorithms(prev => [...prev, algorithmId]);
    }
  };

  const removeAlgorithm = (algorithmId: string) => {
    setSelectedAlgorithms(prev => prev.filter(id => id !== algorithmId));
    // Remove results for this algorithm
    setComparisonResults(prev => {
      const newMap = new Map(prev);
      expressions.forEach(expr => {
        newMap.delete(getCellKey(algorithmId, expr));
      });
      return newMap;
    });
  };

  const addExpression = () => {
    if (newExpression.trim() && !expressions.includes(newExpression.trim())) {
      setExpressions(prev => [...prev, newExpression.trim()]);
      setNewExpression('');
    }
  };

  const removeExpression = (expression: string) => {
    setExpressions(prev => prev.filter(expr => expr !== expression));
    // Remove results for this expression
    setComparisonResults(prev => {
      const newMap = new Map(prev);
      selectedAlgorithms.forEach(alg => {
        newMap.delete(getCellKey(alg, expression));
      });
      return newMap;
    });
  };

  const clearAllAlgorithms = () => {
    setSelectedAlgorithms([]);
    setComparisonResults(new Map());
  };

  const clearAllExpressions = () => {
    setExpressions([]);
    setComparisonResults(new Map());
  };

  // Handle drag end for both algorithms and expressions
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    // Check if dragging algorithms
    if (selectedAlgorithms.includes(active.id as string)) {
      const oldIndex = selectedAlgorithms.indexOf(active.id as string);
      const newIndex = selectedAlgorithms.indexOf(over.id as string);

      if (oldIndex !== newIndex) {
        setSelectedAlgorithms(arrayMove(selectedAlgorithms, oldIndex, newIndex));
      }
    }
    
    // Check if dragging expressions
    if (expressions.includes(active.id as string)) {
      const oldIndex = expressions.indexOf(active.id as string);
      const newIndex = expressions.indexOf(over.id as string);

      if (oldIndex !== newIndex) {
        setExpressions(arrayMove(expressions, oldIndex, newIndex));
      }
    }
  };

  // Auto-run comparisons when algorithms or expressions change
  useEffect(() => {
    if (selectedAlgorithms.length > 0 && expressions.length > 0) {
      runAllComparisons();
    }
  }, [selectedAlgorithms, expressions, runAllComparisons]);



  const handleCellClick = (algorithmId: string, expression: string) => {
    const key = getCellKey(algorithmId, expression);
    const cell = comparisonResults.get(key);
    
    setModalData({
      algorithmId,
      expression,
      result: cell?.result
    });
    setModalOpen(true);
  };

  const renderCell = (algorithmId: string, expression: string) => {
    const key = getCellKey(algorithmId, expression);
    const cell = comparisonResults.get(key);

    if (!cell) {
      return (
        <div 
          className="flex items-center justify-center h-10 cursor-pointer hover:bg-accent/50 transition-all duration-200 card-hover"
          onClick={() => handleCellClick(algorithmId, expression)}
          title="Click to view detailed derivation"
        >
          <span className="text-muted-foreground text-xs animate-pulse">Pending...</span>
        </div>
      );
    }

    if (cell.loading) {
      return (
        <div 
          className="flex items-center justify-center h-10 cursor-pointer hover:bg-accent/50 transition-all duration-200 card-hover"
          onClick={() => handleCellClick(algorithmId, expression)}
          title="Click to view detailed derivation"
        >
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-loading-dots-1"></div>
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-loading-dots-2"></div>
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-loading-dots-3"></div>
          </div>
        </div>
      );
    }

    if (!cell.result) {
      return (
        <div 
          className="flex items-center justify-center h-10 cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => handleCellClick(algorithmId, expression)}
          title="Click to view detailed derivation"
        >
          <span className="text-muted-foreground text-xs">No result</span>
        </div>
      );
    }

    if (!cell.result.success) {
      return (
        <div 
          className="flex items-center justify-center h-10 cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => handleCellClick(algorithmId, expression)}
          title="Click to view detailed derivation"
        >
          <CrossIcon className="h-4 w-4 text-destructive" />
        </div>
      );
    }

    if (cell.result.finalType) {
      return (
        <div 
          className="flex flex-col items-center justify-center h-10 gap-1 p-1 cursor-pointer hover:bg-accent/50 transition-all duration-200 card-hover"
          onClick={() => handleCellClick(algorithmId, expression)}
          title="Click to view detailed derivation"
        >
          <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
          <div className="text-xs max-w-full overflow-hidden">
            <KaTeXRenderer 
              expression={cell.result.finalType} 
              className="text-xs"
            />
          </div>
        </div>
      );
    }

    return (
      <div 
        className="flex items-center justify-center h-10 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => handleCellClick(algorithmId, expression)}
        title="Click to view detailed derivation"
      >
        <Check className="h-4 w-4 text-green-500" />
      </div>
    );
  };

  const availableAlgorithms = algorithms.filter(alg => !selectedAlgorithms.includes(alg.Id));
  
  // Filter algorithms based on search query
  const filteredAlgorithms = availableAlgorithms.filter(algorithm => {
    if (!algorithmSearch.trim()) return true;
    
    const searchLower = algorithmSearch.toLowerCase();
    const nameMatch = algorithm.Name.toLowerCase().includes(searchLower);
    const idMatch = algorithm.Id.toLowerCase().includes(searchLower);
    const labelsMatch = algorithm.Labels?.some(label => 
      label.toLowerCase().includes(searchLower)
    );
    
    return nameMatch || idMatch || labelsMatch;
  });

  // Define content variables for desktop panel layout
  const algorithmsContent = (
    <div className="h-full flex flex-col bg-background border-r border-border">
      <div className="p-2 flex items-center justify-between h-10">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Binary className="w-4 h-4 text-primary" />
          Algorithms
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCollapseAlgorithms}
            className="h-6 w-6 p-0 opacity-60 hover:opacity-100 transition-smooth"
            title="Minimize panel"
          >
            <Minus className="w-3 w-3" />
          </Button>
          {selectedAlgorithms.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllAlgorithms} className="h-6 w-6 p-0 opacity-60 hover:opacity-100 transition-smooth">
              <RotateCcw className="h-3 w-3 transition-transform duration-200 hover:rotate-180" />
            </Button>
          )}
        </div>
      </div>
      <div className="mx-2 border-b border-border"></div>
      <div className="flex-1 p-3 overflow-y-auto">
        <div className="space-y-3">
          <SortableContext items={selectedAlgorithms} strategy={horizontalListSortingStrategy}>
            <div className="flex flex-wrap gap-2">
              {selectedAlgorithms.map((algorithmId) => {
                const algorithm = algorithms.find(a => a.Id === algorithmId);
                return (
                  <SortableAlgorithmBadge
                    key={algorithmId}
                    algorithmId={algorithmId}
                    algorithm={algorithm}
                    onRemove={removeAlgorithm}
                  />
                );
              })}
            </div>
          </SortableContext>
          
          <AlgorithmSelector
            algorithms={algorithms}
            onAlgorithmChange={(algorithmId) => {
              addAlgorithm(algorithmId);
              setAlgorithmSearch('');
            }}
          />
        </div>
      </div>
    </div>
  );

  const expressionsContent = (
    <div className="h-full flex flex-col bg-background border-r border-border">
      <div className="p-2 flex items-center justify-between h-10">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Code className="w-4 h-4 text-primary" />
          Expressions
        </h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleCollapseExpression} className="h-6 w-6 p-0 opacity-60 hover:opacity-100 transition-smooth">
            <Minus className="h-3 w-3" />
          </Button>
          {expressions.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllExpressions} className="h-6 w-6 p-0 opacity-60 hover:opacity-100 transition-smooth">
              <RotateCcw className="h-3 w-3 transition-transform duration-200 hover:rotate-180" />
            </Button>
          )}
        </div>
      </div>
      <div className="mx-2 border-b border-border"></div>
      <div className="flex-1 p-3 overflow-y-auto">
        <div className="space-y-3">
          <SortableContext items={expressions} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {expressions.map((expression) => (
                <SortableExpressionItem
                  key={expression}
                  expression={expression}
                  onRemove={removeExpression}
                />
              ))}
            </div>
          </SortableContext>
          
          <div className="flex gap-1">
            <Input
              value={newExpression}
              onChange={(e) => setNewExpression(e.target.value)}
              placeholder="Add expression..."
              onKeyDown={(e) => e.key === 'Enter' && addExpression()}
              className="flex-1 font-code text-xs h-7 px-2"
            />
            <Button onClick={addExpression} size="sm" className="h-7 w-7 p-0">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          
          {/* Expression History */}
          <ExpressionHistory 
            onSelectExpression={(expression) => {
              if (!expressions.includes(expression)) {
                setExpressions(prev => [...prev, expression]);
              }
            }}
            onAddToHistory={() => {}} // Not used in compare mode, history comes from main playground
          />
        </div>
      </div>
    </div>
  );

  const comparisonContent = (
    <div className="h-full flex flex-col bg-background">
      <div className="p-2 flex items-center justify-between h-10">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Table2 className="w-4 h-4 text-primary" />
              Comparison
            </h3>

          </div>
          <div className="flex items-center border rounded-md p-0.5 bg-muted/50">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className={`h-6 px-2 text-xs ${viewMode === 'table' ? 'shadow-sm' : 'hover:bg-transparent'}`}
            >
              <Table2 className="h-3 w-3 mr-1" />
              Table
            </Button>
            <Button
              variant={viewMode === 'sidebyside' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('sidebyside')}
              className={`h-6 px-2 text-xs ${viewMode === 'sidebyside' ? 'shadow-sm' : 'hover:bg-transparent'}`}
            >
              <SquareSplitHorizontal className="h-3 w-3" />
              Split
            </Button>
          </div>
        </div>
        <CompareShareExportButtons
          selectedAlgorithms={selectedAlgorithms}
          expressions={expressions}
          comparisonResults={comparisonResults}
        />
      </div>
      <div className="mx-2 border-b border-border"></div>
      <div className="flex-1 p-3 overflow-y-auto">
        {viewMode === 'table' ? (
          selectedAlgorithms.length === 0 || expressions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {selectedAlgorithms.length === 0 && "Select at least one algorithm"}
              {selectedAlgorithms.length === 0 && expressions.length === 0 && " and "}
              {expressions.length === 0 && "add at least one expression"}
              {" to start comparing."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px] h-8 py-1 px-2 text-xs">Expression</TableHead>
                    {selectedAlgorithms.map(algorithmId => {
                      const algorithm = algorithms.find(a => a.Id === algorithmId);
                      return (
                        <TableHead key={algorithmId} className="text-center min-w-[90px] h-8 py-1 px-1 text-xs">
                          <div className="font-semibold truncate">{algorithm?.Name || algorithmId}</div>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expressions.map(expression => (
                    <TableRow key={expression} className="border-b">
                      <TableCell className="font-code text-xs border-r py-1 px-2">
                        <code className="text-xs">{expression}</code>
                      </TableCell>
                      {selectedAlgorithms.map(algorithmId => (
                        <TableCell key={`${expression}-${algorithmId}`} className="text-center py-0 px-1">
                          {renderCell(algorithmId, expression)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        ) : (
          <SideBySideComparison
            selectedAlgorithms={selectedAlgorithms}
            expressions={expressions}
            comparisonResults={comparisonResults}
          />
        )}
      </div>
    </div>
  );

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="h-screen bg-background flex flex-col overflow-hidden">
          <Navbar />
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile: Hide the traditional stacked layout - we'll use the panel layout for all screens */}
            <div className="hidden w-full max-w-[1600px] mx-auto px-2 sm:px-4 py-2 sm:py-4 flex-1 overflow-y-auto">
              <div className="space-y-2 sm:space-y-3">
                {/* Mobile header */}
                <div className="mb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <Table2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
                      <h1 className="text-base sm:text-2xl font-bold truncate">Algorithm Comparison</h1>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const url = new URL(window.location.href);
                        url.searchParams.delete('compare');
                        window.history.pushState({}, '', url.toString());
                        window.dispatchEvent(new PopStateEvent('popstate'));
                      }}
                      className="btn-interactive h-9 px-3 flex items-center gap-2"
                    >
                      <Undo2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Return</span>
                    </Button>
                  </div>
                  <p className="text-muted-foreground">Compare type inference algorithms across different expressions</p>
                </div>

                {/* Mobile Algorithm Selection */}
                <div className="animate-stagger-1 hover-scale-sm">
                  <Card className="academic-panel transition-smooth">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                      <CardTitle className="text-base">Selected Algorithms</CardTitle>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setAlgorithmsCollapsed(true)} className="h-6 w-6 p-0 opacity-60 hover:opacity-100 transition-smooth">
                          <Minus className="h-3 w-3" />
                        </Button>
                        {selectedAlgorithms.length > 0 && (
                          <Button variant="ghost" size="sm" onClick={clearAllAlgorithms} className="h-6 w-6 p-0 opacity-60 hover:opacity-100 transition-smooth">
                            <RotateCcw className="h-3 w-3 transition-transform duration-200 hover:rotate-180" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <SortableContext items={selectedAlgorithms} strategy={horizontalListSortingStrategy}>
                        <div className="flex flex-wrap gap-2">
                          {selectedAlgorithms.map((algorithmId) => {
                            const algorithm = algorithms.find(a => a.Id === algorithmId);
                            return (
                              <SortableAlgorithmBadge
                                key={algorithmId}
                                algorithmId={algorithmId}
                                algorithm={algorithm}
                                onRemove={removeAlgorithm}
                              />
                            );
                          })}
                        </div>
                      </SortableContext>
                      
                      <AlgorithmSelector
                        algorithms={algorithms}
                        onAlgorithmChange={(algorithmId) => {
                          addAlgorithm(algorithmId);
                          setAlgorithmSearch('');
                        }}
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Mobile Expressions */}
                <div className="animate-stagger-2 hover-scale-sm">
                  <Card className="academic-panel transition-smooth">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                      <CardTitle className="text-base">Expressions</CardTitle>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={handleCollapseExpression} className="h-6 w-6 p-0 opacity-60 hover:opacity-100 transition-smooth">
                          <Minus className="h-3 w-3" />
                        </Button>
                        {expressions.length > 0 && (
                          <Button variant="ghost" size="sm" onClick={clearAllExpressions} className="h-6 w-6 p-0 opacity-60 hover:opacity-100 transition-smooth">
                            <RotateCcw className="h-3 w-3 transition-transform duration-200 hover:rotate-180" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <SortableContext items={expressions} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                          {expressions.map((expression) => (
                            <SortableExpressionItem
                              key={expression}
                              expression={expression}
                              onRemove={removeExpression}
                            />
                          ))}
                        </div>
                      </SortableContext>
                      
                      <div className="flex gap-1">
                        <Input
                          value={newExpression}
                          onChange={(e) => setNewExpression(e.target.value)}
                          placeholder="Add expression..."
                          onKeyDown={(e) => e.key === 'Enter' && addExpression()}
                          className="flex-1 font-code text-xs h-7 px-2"
                        />
                        <Button onClick={addExpression} size="sm" className="h-7 w-7 p-0">
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      {/* Expression History */}
                      <ExpressionHistory 
                        onSelectExpression={(expression) => {
                          if (!expressions.includes(expression)) {
                            setExpressions(prev => [...prev, expression]);
                          }
                        }}
                        onAddToHistory={() => {}} // Not used in compare mode, history comes from main playground
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Mobile Comparison */}
                <div className="animate-stagger-3 hover-scale-sm">
                  <Card className="academic-panel">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <CardTitle>Comparison</CardTitle>

                        </div>
                        <div className="flex items-center border rounded-md p-0.5 bg-muted/50">
                          <Button
                            variant={viewMode === 'table' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('table')}
                            className={`h-6 px-2 text-xs ${viewMode === 'table' ? 'shadow-sm' : 'hover:bg-transparent'}`}
                          >
                            <Table2 className="h-3 w-3 mr-1" />
                            Table
                          </Button>
                          <Button
                            variant={viewMode === 'sidebyside' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('sidebyside')}
                            className={`h-6 px-2 text-xs ${viewMode === 'sidebyside' ? 'shadow-sm' : 'hover:bg-transparent'}`}
                          >
                            <SquareSplitHorizontal className="h-3 w-3 mr-1" />
                            Split
                          </Button>
                        </div>
                      </div>
                      <CompareShareExportButtons
                        selectedAlgorithms={selectedAlgorithms}
                        expressions={expressions}
                        comparisonResults={comparisonResults}
                      />
                    </CardHeader>
                    <CardContent>
                      {viewMode === 'table' ? (
                        selectedAlgorithms.length === 0 || expressions.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            {selectedAlgorithms.length === 0 && "Select at least one algorithm"}
                            {selectedAlgorithms.length === 0 && expressions.length === 0 && " and "}
                            {expressions.length === 0 && "add at least one expression"}
                            {" to start comparing."}
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table className="table-fixed">
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="min-w-[180px] h-8 py-1 px-2 text-xs">Expression</TableHead>
                                  {selectedAlgorithms.map(algorithmId => {
                                    const algorithm = algorithms.find(a => a.Id === algorithmId);
                                    return (
                                      <TableHead key={algorithmId} className="text-center min-w-[90px] h-8 py-1 px-1 text-xs">
                                        <div className="font-semibold truncate">{algorithm?.Name || algorithmId}</div>
                                      </TableHead>
                                    );
                                  })}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {expressions.map(expression => (
                                  <TableRow key={expression} className="border-b">
                                    <TableCell className="font-code text-xs border-r py-1 px-2">
                                      <code className="text-xs">{expression}</code>
                                    </TableCell>
                                    {selectedAlgorithms.map(algorithmId => (
                                      <TableCell key={`${expression}-${algorithmId}`} className="text-center py-0 px-1">
                                        {renderCell(algorithmId, expression)}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )
                      ) : (
                        <SideBySideComparison
                          selectedAlgorithms={selectedAlgorithms}
                          expressions={expressions}
                          comparisonResults={comparisonResults}
                        />
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

              {isMobile ? (
                // Mobile tab layout
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                  <div className="border-b border-border bg-background">
                    <TabsList className="grid w-full grid-cols-3 h-auto p-1">
                      <TabsTrigger value="algorithms" className="text-xs py-2">
                        <Binary className="w-3 h-3 mr-1" />
                        Algorithms
                      </TabsTrigger>
                      <TabsTrigger value="expressions" className="text-xs py-2">
                        <Code className="w-3 h-3 mr-1" />
                        Expressions
                      </TabsTrigger>
                      <TabsTrigger value="comparison" className="text-xs py-2">
                        <Table2 className="w-3 h-3 mr-1" />
                        Comparison
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <TabsContent value="algorithms" className="h-full m-0">
                      {algorithmsContent}
                    </TabsContent>
                    <TabsContent value="expressions" className="h-full m-0">
                      {expressionsContent}
                    </TabsContent>
                    <TabsContent value="comparison" className="h-full m-0">
                      {comparisonContent}
                    </TabsContent>
                  </div>
                </Tabs>
              ) : (
                // Desktop panel layout
                <div className="flex flex-1 overflow-hidden">
                  <PanelGroup direction="horizontal" className="h-full">
                    {/* Left Panel - Algorithm Selector */}
                    <Panel 
                      ref={algorithmsRef}
                      id="algorithms"
                      order={1}
                      defaultSize={25} 
                      minSize={15} 
                      maxSize={40} 
                      collapsible={true}
                      collapsedSize={3}
                      onCollapse={() => setAlgorithmsCollapsed(true)}
                      onExpand={() => setAlgorithmsCollapsed(false)}
                    >
                      {algorithmsCollapsed ? (
                        <div 
                          className="h-full w-full flex flex-col items-center justify-center bg-background border-r border-border hover:bg-muted/30 transition-colors cursor-pointer group"
                          onClick={handleExpandAlgorithms}
                        >
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="flex items-center justify-center" style={{ height: '60px', width: '20px' }}>
                              <span 
                                className="text-sm font-medium text-muted-foreground group-hover:text-foreground whitespace-nowrap select-none"
                                style={{ 
                                  transform: 'rotate(270deg)',
                                  transformOrigin: 'center'
                                }}
                              >
                                Algorithms
                              </span>
                            </div>
                            <Binary className="w-4 h-4 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col bg-background border-r border-border">
                          <div className="p-2 flex items-center justify-between h-10">
                            <h3 className="text-sm font-medium flex items-center gap-2">
                              <Binary className="w-4 h-4 text-primary" />
                              Algorithms
                            </h3>
                            <div className="flex items-center gap-1">
                              {selectedAlgorithms.length > 0 && (
                                <Button variant="ghost" size="sm" onClick={clearAllAlgorithms} className="h-6 w-6 p-0 opacity-60 hover:opacity-100 transition-smooth">
                                  <RotateCcw className="w-3 h-3 transition-transform duration-200 hover:rotate-180" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCollapseAlgorithms}
                                className="h-6 w-6 p-0 opacity-60 hover:opacity-100 transition-smooth"
                                title="Minimize panel"
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="mx-2 border-b border-border"></div>
                          <div className="flex-1 p-3 overflow-y-auto">
                            <div className="space-y-3">
                              <SortableContext items={selectedAlgorithms} strategy={horizontalListSortingStrategy}>
                                <div className="flex flex-wrap gap-2">
                                  {selectedAlgorithms.map((algorithmId) => {
                                    const algorithm = algorithms.find(a => a.Id === algorithmId);
                                    return (
                                      <SortableAlgorithmBadge
                                        key={algorithmId}
                                        algorithmId={algorithmId}
                                        algorithm={algorithm}
                                        onRemove={removeAlgorithm}
                                      />
                                    );
                                  })}
                                </div>
                              </SortableContext>
                              
                              <AlgorithmSelector
                                algorithms={algorithms}
                                onAlgorithmChange={(algorithmId) => {
                                  addAlgorithm(algorithmId);
                                  setAlgorithmSearch('');
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </Panel>

                <PanelResizeHandle className="bg-border hover:bg-primary/20 transition-colors shadow-sm" style={{ width: '0.5px' }} />

                    {/* Middle Panel - Expressions */}
                    <Panel 
                      ref={expressionRef}
                      id="expressions"
                      order={2}
                      defaultSize={25} 
                      minSize={20} 
                      maxSize={40} 
                      collapsible={true}
                      collapsedSize={3}
                      onCollapse={() => setExpressionCollapsed(true)}
                      onExpand={() => setExpressionCollapsed(false)}
                    >
                      {expressionCollapsed ? (
                        <div 
                          className="h-full w-full flex flex-col items-center justify-center bg-background border-r border-border hover:bg-muted/30 transition-colors cursor-pointer group"
                          onClick={handleExpandExpression}
                        >
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="flex items-center justify-center" style={{ height: '60px', width: '20px' }}>
                              <span 
                                className="text-sm font-medium text-muted-foreground group-hover:text-foreground whitespace-nowrap select-none"
                                style={{ 
                                  transform: 'rotate(270deg)',
                                  transformOrigin: 'center'
                                }}
                              >
                                Expressions
                              </span>
                            </div>
                            <Code className="w-4 h-4 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
                          </div>
                        </div>
                      ) : (
                        expressionsContent
                      )}
                    </Panel>

                <PanelResizeHandle className="bg-border hover:bg-primary/20 transition-colors shadow-sm" style={{ width: '0.5px' }} />

                    {/* Right Panel - Comparison Table */}
                    <Panel id="comparison" order={3} defaultSize={50} minSize={35}>
                      {comparisonContent}
                    </Panel>
                  </PanelGroup>
                </div>
              )}
            </div>
          </div>
      </DndContext>
        
      {/* Derivation Modal */}
      {modalData && (
        <DerivationModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          algorithmId={modalData.algorithmId}
          expression={modalData.expression}
          result={modalData.result}
        />
      )}
    </>
  );
};

export default Compare;