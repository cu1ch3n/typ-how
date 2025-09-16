import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { KaTeXRenderer } from './KaTeXRenderer';
import { TypingRule, RuleSection } from '@/types/inference';
import { TreeViewer } from './TreeViewer';
import { DerivationStep, InferenceResult, TypeInferenceAlgorithm } from '@/types/inference';
import { Workflow, Activity, TreePine, Zap } from 'lucide-react';
import { ShareExportButtons } from './ShareExportButtons';
import { RuleTooltip } from './RuleTooltip';

interface DerivationViewerProps {
  result?: InferenceResult;
  algorithm?: TypeInferenceAlgorithm;
  activeStepPath?: number[];
  activeRuleId?: string;
  onStepClick?: (stepPath: number[]) => void;
  expression: string;
  isInferring: boolean;
  variant?: string;
}

export const DerivationViewer = ({ 
  result, 
  algorithm, 
  activeStepPath, 
  activeRuleId, 
  onStepClick,
  expression,
  isInferring,
  variant
}: DerivationViewerProps) => {

  // Helper function to get flat rules for backward compatibility
  const getFlatRules = (rules: TypingRule[] | RuleSection[]): TypingRule[] => {
    if (rules && rules.length > 0 && 'Rules' in rules[0]) {
      return (rules as RuleSection[]).flatMap(section => section.Rules);
    }
    return rules as TypingRule[];
  };

  const renderLinearStep = (step: DerivationStep, stepPath: number[]) => {
    const isActiveByPath = activeStepPath && activeStepPath.join('-') === stepPath.join('-');
    const isActiveByRule = activeRuleId && step.ruleId === activeRuleId;
    const isActive = isActiveByPath || isActiveByRule;

    return (
      <div
        key={stepPath.join('-')}
        className={`
          derivation-step p-2 rounded-lg font-mono transition-all duration-200
          ${isActive ? 'bg-highlight/30 border-primary shadow-sm border' : 'hover:bg-muted/30'}
          ${onStepClick ? 'cursor-pointer' : ''}
        `}
        onClick={() => onStepClick?.(stepPath)}
      >
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs min-w-[2rem] shrink-0 text-center font-mono">
            {((stepPath && stepPath.length > 0 ? stepPath[stepPath.length - 1] : 0) + 1).toString().padStart(2, ' ')}
          </Badge>
          
          <div className="flex-1 min-w-0">
            <KaTeXRenderer 
              expression={step.expression} 
              displayMode={false}
              className="text-sm"
            />
          </div>
          
          <RuleTooltip 
            ruleId={step.ruleId}
            rules={algorithm?.RuleGroups ? getFlatRules(algorithm.RuleGroups) : algorithm?.Rules ? getFlatRules(algorithm.Rules) : []}
            variant="secondary"
            className="text-xs font-medium ml-auto transition-smooth hover:scale-105"
          />
        </div>
      </div>
    );
  };

  const flattenSteps = (steps: DerivationStep[]): Array<{step: DerivationStep, path: number[]}> => {
    const result: Array<{step: DerivationStep, path: number[]}> = [];
    const visit = (step: DerivationStep, path: number[]) => {
      result.push({step, path});
      if (step.children) {
        step.children.forEach((child, index) => visit(child, [...path, index]));
      }
    };
    steps.forEach((step, index) => visit(step, [index]));
    return result;
  };

  if (isInferring) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <div className="text-center space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-primary rounded-full animate-loading-dots-1"></div>
            <div className="w-3 h-3 bg-primary rounded-full animate-loading-dots-2"></div>
            <div className="w-3 h-3 bg-primary rounded-full animate-loading-dots-3"></div>
          </div>
          <p className="font-medium animate-pulse">Running type inference...</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground/70">
            <Activity className="w-3 h-3 animate-pulse" />
            <span>Analyzing expression types</span>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <div className="text-center space-y-2">
          <p className="font-medium">No derivation yet</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground/70">
            <Zap className="w-3 h-3" />
            <span>Enter an expression to start type inference</span>
          </div>
        </div>
      </div>
    );
  }

  const viewMode = algorithm?.ViewMode || 'tree';
  const linearSteps = flattenSteps(result.derivation);
  const hasDerivation = result.derivation && result.derivation.length > 0;

  return (
    <div 
      key={`${algorithm?.Id}-${expression}-${result?.success}-${result?.derivation?.length}`}
      className="space-y-4" 
      data-derivation-viewer
    >
      {/* Show error if present */}
      {!result.success && result.error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-destructive font-medium flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Error
          </p>
          <div className="text-sm text-destructive/80 mt-2">
            {result.errorLatex ? (
              <KaTeXRenderer 
                expression={result.error} 
                displayMode={false}
                className="text-destructive/80"
              />
            ) : (
              <pre className="font-mono whitespace-pre-wrap text-destructive/80">{result.error}</pre>
            )}
          </div>
        </div>
      )}
      
      {/* Show derivation if available */}
      {hasDerivation && (
        <>
          {!result.success && (
            <div className="text-sm text-muted-foreground mb-2">
              Partial derivation before error:
            </div>
          )}
          <div>
            {viewMode === 'tree' ? (
              <TreeViewer 
                steps={result.derivation}
                rules={algorithm?.RuleGroups ? getFlatRules(algorithm.RuleGroups) : algorithm?.Rules ? getFlatRules(algorithm.Rules) : undefined}
                onStepClick={onStepClick}
                activeStepPath={activeStepPath}
                activeRuleId={activeRuleId}
                expandedByDefault={true}
              />
            ) : (
              <div className="space-y-1">
                {linearSteps.map(({step, path}, index) => (
                  <div key={path.join('-')}>
                    {renderLinearStep(step, path)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Show message if no derivation available */}
      {!hasDerivation && result.success && (
        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
          <p className="text-sm">No derivation steps available</p>
        </div>
      )}
    </div>
  );
};