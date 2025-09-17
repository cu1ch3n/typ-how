import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Circle } from 'lucide-react';
import { KaTeXRenderer } from './KaTeXRenderer';
import { DerivationStep, TypingRule } from '@/types/inference';
import { RuleTooltip } from './RuleTooltip';

interface TreeViewerProps {
  steps: DerivationStep[];
  rules?: TypingRule[];
  onStepClick?: (stepPath: number[]) => void;
  activeStepPath?: number[];
  activeRuleId?: string;
  expandedByDefault?: boolean;
}

export const TreeViewer = ({ 
  steps, 
  rules = [],
  onStepClick, 
  activeStepPath, 
  activeRuleId,
  expandedByDefault = true 
}: TreeViewerProps) => {
  const initializeExpandedSteps = () => {
    if (!expandedByDefault) return new Set<string>();
    const expanded = new Set<string>();
    const addAllPaths = (steps: DerivationStep[], basePath: number[] = []) => {
      steps.forEach((step, index) => {
        const path = [...basePath, index];
        expanded.add(path.join('-'));
        if (step.children) addAllPaths(step.children, path);
      });
    };
    addAllPaths(steps);
    return expanded;
  };
  
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(initializeExpandedSteps());

  // Re-initialize expanded steps when steps change and expandedByDefault is true
  useEffect(() => {
    if (expandedByDefault && steps.length > 0) {
      setExpandedSteps(initializeExpandedSteps());
    }
  }, [steps.length, expandedByDefault]); // Only depend on length, not the entire steps array

  const toggleExpanded = (stepPath: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepPath)) {
      newExpanded.delete(stepPath);
    } else {
      newExpanded.add(stepPath);
    }
    setExpandedSteps(newExpanded);
  };

  const renderTreeNode = (step: DerivationStep, path: number[], isLast = false) => {
    const pathKey = path.join('-');
    const isExpanded = expandedSteps.has(pathKey);
    const hasChildren = step.children && step.children.length > 0;
    // Check if active by step path OR by rule ID match
    const isActiveByPath = activeStepPath && activeStepPath.join('-') === pathKey;
    const isActiveByRule = activeRuleId && step.ruleId === activeRuleId;
    const isActive = isActiveByPath || isActiveByRule;

    return (
      <li key={pathKey} className="relative">
        <div
          className={`
            flex items-center gap-2 py-1 pr-2 rounded transition-all duration-200
            ${isActive ? 'bg-highlight/30 border-primary shadow-sm border' : 'hover:bg-muted/40'}
            ${onStepClick ? 'cursor-pointer' : ''}
          `}
          onClick={() => onStepClick?.(path)}
        >
          {/* Expand/collapse button */}
          <div className="flex items-center justify-center w-5 h-5 shrink-0">
            {hasChildren ? (
                <button
                className="w-4 h-4 flex items-center justify-center rounded hover:bg-muted-foreground/20 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded(pathKey);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>
            ) : (
              <div className="w-2 h-2" />
            )}
          </div>
          
          {/* Expression */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <KaTeXRenderer 
              expression={step.expression} 
              displayMode={false}
              className="text-sm"
            />
          </div>
          
          {/* Rule badge - aligned right */}
          <RuleTooltip 
            ruleId={step.ruleId}
            rules={rules}
            variant={isActive ? "default" : "secondary"}
            className="text-xs font-medium shrink-0 min-w-fit ml-auto"
            isActive={isActive}
          />
        </div>

        {/* Children - nested list */}
        {hasChildren && isExpanded && step.children && (
          <ul className="ml-5 border-l border-muted-foreground/20 pl-3 mt-0.5 space-y-0.5">
            {step.children.map((child, index) => 
              renderTreeNode(child, [...path, index], index === (step.children?.length || 0) - 1)
            )}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="tree-view">
      <ul className="space-y-0.5">
        {steps.map((step, index) => (
          <div key={index} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
            {renderTreeNode(step, [index], index === steps.length - 1)}
          </div>
        ))}
      </ul>
    </div>
  );
};