import { useState, useEffect, forwardRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, RotateCcw, Code, Lightbulb, Loader2, HelpCircle, ArrowRight } from 'lucide-react';
import { TypeInferenceAlgorithm } from '@/types/inference';
import { HelpModal } from './HelpModal';
import { ExpressionHistory } from './ExpressionHistory';
import { LatexText } from './LatexText';
import { MonacoEditor, MonacoEditorRef } from './MonacoEditor';

interface ExpressionInputProps {
  expression: string;
  onExpressionChange: (expression: string) => void;
  onInfer: () => void;
  isInferring: boolean;
  selectedAlgorithm: string;
  algorithms: TypeInferenceAlgorithm[];
  selectedVariant?: string;
}

export const ExpressionInput = forwardRef<MonacoEditorRef, ExpressionInputProps>(({
  expression,
  onExpressionChange,
  onInfer,
  isInferring,
  selectedAlgorithm,
  algorithms,
  selectedVariant
}, ref) => {
  const [selectedExample, setSelectedExample] = useState<string>('');
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [leftType, setLeftType] = useState<string>('');
  const [rightType, setRightType] = useState<string>('');
  const [addToHistoryFunction, setAddToHistoryFunction] = useState<((expression: string) => void) | null>(null);
  
  const selectedAlgorithmData = algorithms.find(a => a.Id === selectedAlgorithm);
  const isSubtypingMode = selectedAlgorithmData?.Mode === 'subtyping';
  
  // Get examples from the selected algorithm
  const currentExamples = selectedAlgorithmData?.Examples || [];

  const handleExampleSelect = (exampleName: string) => {
    const example = currentExamples.find(e => e.Name === exampleName);
    if (example) {
      if (isSubtypingMode) {
        // Parse subtyping examples like "Int <: Top" into left and right types
        const parts = example.Expression.split(' <: ');
        if (parts.length === 2) {
          setLeftType(parts[0].trim());
          setRightType(parts[1].trim());
          onExpressionChange(`${parts[0].trim()} <: ${parts[1].trim()}`);
        } else {
          setLeftType(example.Expression);
          setRightType('');
          onExpressionChange(example.Expression);
        }
      } else {
        onExpressionChange(example.Expression);
      }
      setSelectedExample(exampleName);
    }
  };

  const handleClear = () => {
    onExpressionChange('');
    setSelectedExample('');
    if (isSubtypingMode) {
      setLeftType('');
      setRightType('');
    }
  };

  const handleInfer = () => {
    // Add current expression to history when running inference
    if (addToHistoryFunction && expression && expression.trim()) {
      addToHistoryFunction(expression.trim());
    }
    onInfer();
  };

  // Reset selected example when algorithm changes
  useEffect(() => {
    setSelectedExample('');
  }, [selectedAlgorithm]);

  // Reset selected example when expression changes and doesn't match current example
  useEffect(() => {
    if (selectedExample) {
      const currentExample = currentExamples.find(e => e.Name === selectedExample);
      if (currentExample && currentExample.Expression !== expression) {
        setSelectedExample('');
      }
    }
  }, [expression, selectedExample, currentExamples]);

  // Update expression when left/right types change in subtyping mode
  useEffect(() => {
    if (isSubtypingMode && (leftType || rightType)) {
      const newExpression = leftType && rightType ? `${leftType} <: ${rightType}` : leftType || rightType;
      onExpressionChange(newExpression);
    }
  }, [leftType, rightType, isSubtypingMode, onExpressionChange]);

  // Parse existing expression into left/right types for subtyping
  useEffect(() => {
    if (isSubtypingMode && expression && expression.includes(' <: ')) {
      const parts = expression.split(' <: ');
      if (parts.length === 2) {
        setLeftType(parts[0].trim());
        setRightType(parts[1].trim());
      }
    }
  }, [expression, isSubtypingMode]);

  if (isSubtypingMode) {
    return (
      <div className="space-y-4">
        <div className="border-b border-border pb-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Code className="w-4 h-4 text-primary" />
            Subtyping Check
          </h3>
        </div>
        <div className="space-y-3">
          <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <Select value={selectedExample} onValueChange={handleExampleSelect}>
              <SelectTrigger className="w-full bg-card transition-smooth hover:border-primary/50">
                <div className="flex items-start gap-2 w-full min-w-0">
                  <Lightbulb className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-1" />
                  {selectedExample ? (
                    <div className="flex flex-col min-w-0 flex-1 overflow-hidden items-start" style={{ maxWidth: 'calc(100% - 2rem)' }}>
                      <span 
                        className="font-medium text-sm text-left" 
                        style={{ 
                          whiteSpace: 'nowrap', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          maxWidth: '100%',
                          textAlign: 'left'
                        }}
                      >
                        {selectedExample}
                      </span>
                      <span 
                        className="text-xs text-muted-foreground font-code text-left" 
                        style={{ 
                          whiteSpace: 'nowrap', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          maxWidth: '100%',
                          textAlign: 'left'
                        }}
                      >
                        {currentExamples.find(e => e.Name === selectedExample)?.Expression}
                      </span>
                    </div>
                  ) : (
                    <SelectValue placeholder="Choose an example..." />
                  )}
                </div>
              </SelectTrigger>
              <SelectContent className="animate-fade-in-scale">
                 {currentExamples.map((example, index) => (
                  <SelectItem 
                    key={example.Name} 
                    value={example.Name}
                    className="transition-fast hover:bg-accent/50"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{example.Name}</span>
                      <span className="text-xs text-muted-foreground font-code truncate">
                        {example.Expression}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="space-y-3">
              {/* Left Type Input */}
              <div className="relative border border-muted-foreground/20 rounded-md overflow-hidden">
                <MonacoEditor
                  value={leftType} 
                  onChange={setLeftType} 
                  placeholder="Left type (e.g., Int, Top -> Int, mu a. a -> Int)" 
                  height="120px"
                  enableSyntaxHighlighting={true}
                  className="min-h-[120px]"
                />
                <div className="absolute top-2 right-2 text-xs text-muted-foreground font-medium z-10 bg-background/80 px-1 rounded">
                  Left
                </div>
                {leftType.trim() && (
                  <Button 
                    onClick={() => setLeftType('')} 
                    variant="ghost" 
                    size="sm" 
                    className="absolute bottom-2 right-2 h-7 w-7 sm:h-8 sm:w-8 p-0 opacity-60 hover:opacity-100 transition-smooth z-10"
                  >
                    <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-200 hover:rotate-180" />
                  </Button>
                )}
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <div className="flex items-center text-muted-foreground">
                  <LatexText text="$\le$" className="text-lg font-medium" />
                </div>
              </div>

              {/* Right Type Input */}
              <div className="relative border border-muted-foreground/20 rounded-md overflow-hidden">
                <MonacoEditor
                  value={rightType} 
                  onChange={setRightType} 
                  placeholder="Right type (e.g., Top, a -> Int, mu a. a -> Int)" 
                  height="120px"
                  enableSyntaxHighlighting={true}
                  className="min-h-[120px]"
                />
                <div className="absolute top-2 right-2 text-xs text-muted-foreground font-medium z-10 bg-background/80 px-1 rounded">
                  Right
                </div>
                {rightType.trim() && (
                  <Button 
                    onClick={() => setRightType('')} 
                    variant="ghost" 
                    size="sm" 
                    className="absolute bottom-2 right-2 h-7 w-7 sm:h-8 sm:w-8 p-0 opacity-60 hover:opacity-100 transition-smooth z-10"
                  >
                    <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-200 hover:rotate-180" />
                  </Button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-between">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setHelpModalOpen(true)}
                  className="opacity-60 hover:opacity-100 transition-smooth"
                >
                  <HelpCircle className="w-3 h-3" />
                </Button>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleClear} 
                    variant="ghost" 
                    size="sm" 
                    className="opacity-60 hover:opacity-100 transition-smooth"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                  <Button 
                    onClick={handleInfer}
                    disabled={!leftType.trim() || !rightType.trim() || isInferring} 
                    size="sm" 
                    className={`
                      btn-interactive transition-smooth touch-manipulation
                      ${isInferring ? 'animate-pulse glow-primary' : 'hover:glow-primary'}
                      ${!leftType.trim() || !rightType.trim() ? 'opacity-50' : ''}
                    `}
                  >
                    {isInferring ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3 transition-transform duration-200 hover:scale-110" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {selectedExample && (
            <div className="p-3 bg-algorithm rounded-lg border border-primary/20 transition-smooth hover:border-primary/40 hover-scale-sm animate-fade-in-up">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {currentExamples.find(e => e.Name === selectedExample)?.Description}
              </p>
            </div>
          )}

          {/* Expression History */}
          <ExpressionHistory 
            onSelectExpression={onExpressionChange}
            onAddToHistory={(func) => {
              setAddToHistoryFunction(() => func);
            }}
          />
        </div>
        
        <HelpModal open={helpModalOpen} onOpenChange={setHelpModalOpen} />
      </div>
    );
  }

  // Original single input mode for type inference
  return (
    <div className="space-y-2 h-full flex flex-col">
        <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <Select value={selectedExample} onValueChange={handleExampleSelect}>
            <SelectTrigger className="w-full bg-card transition-smooth hover:border-primary/50">
              <div className="flex items-start gap-2 w-full min-w-0">
                <Lightbulb className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-1" />
                {selectedExample ? (
                  <div className="flex flex-col min-w-0 flex-1 overflow-hidden items-start" style={{ maxWidth: 'calc(100% - 2rem)' }}>
                    <span 
                      className="font-medium text-sm text-left" 
                      style={{ 
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                        textAlign: 'left'
                      }}
                    >
                      {selectedExample}
                    </span>
                    <span 
                      className="text-xs text-muted-foreground font-code text-left" 
                      style={{ 
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                        textAlign: 'left'
                      }}
                    >
                      {currentExamples.find(e => e.Name === selectedExample)?.Expression}
                    </span>
                  </div>
                ) : (
                  <SelectValue placeholder="Choose an example..." />
                )}
              </div>
            </SelectTrigger>
            <SelectContent className="animate-fade-in-scale">
              {currentExamples.map((example, index) => (
                <SelectItem 
                  key={example.Name} 
                  value={example.Name}
                  className="transition-fast hover:bg-accent/50"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{example.Name}</span>
                    <span className="text-xs text-muted-foreground font-code truncate">
                      {example.Expression}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="animate-fade-in flex-1 flex flex-col" style={{ animationDelay: '0.2s' }}>
          <div className="relative flex-1 flex flex-col border border-muted-foreground/20 rounded-md overflow-hidden">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setHelpModalOpen(true)}
              className="absolute bottom-2 left-2 h-6 w-6 p-0 opacity-60 hover:opacity-100 transition-smooth z-10"
            >
              <HelpCircle className="w-3 h-3" />
            </Button>
            <MonacoEditor
              ref={ref}
              value={expression} 
              onChange={onExpressionChange} 
              placeholder="Please enter an expression. For example, (\x. x) 1" 
              height="100%"
              enableSyntaxHighlighting={true}
              className="h-full"
            />
            {/* Clear button - top right */}
            {expression.trim() && (
              <Button 
                onClick={handleClear} 
                variant="ghost" 
                size="sm" 
                className="absolute top-2 right-2 h-7 w-7 sm:h-8 sm:w-8 p-0 opacity-60 hover:opacity-100 transition-smooth z-10"
              >
                <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-200 hover:rotate-180" />
              </Button>
            )}
            {/* Play button - bottom right */}
            <Button 
              onClick={handleInfer} 
              disabled={!expression.trim() || isInferring} 
              size="sm" 
              className={`
                absolute bottom-2 right-2 h-7 w-7 sm:h-8 sm:w-8 p-0 z-10
                btn-interactive transition-smooth touch-manipulation
                ${isInferring ? 'animate-pulse glow-primary' : 'hover:glow-primary'}
                ${!expression.trim() ? 'opacity-50' : ''}
              `}
            >
              {isInferring ? (
                <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
              ) : (
                <Play className="w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-200 hover:scale-110" />
              )}
            </Button>
          </div>
        </div>

        {selectedExample && (
          <div className="p-3 bg-algorithm rounded-lg border border-primary/20 transition-smooth hover:border-primary/40 hover-scale-sm animate-fade-in-up">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {currentExamples.find(e => e.Name === selectedExample)?.Description}
            </p>
          </div>
          )}

        {/* Expression History */}
        <ExpressionHistory 
          onSelectExpression={onExpressionChange}
          onAddToHistory={(func) => {
            setAddToHistoryFunction(() => func);
          }}
        />
      
      <HelpModal open={helpModalOpen} onOpenChange={setHelpModalOpen} />
    </div>
  );
});