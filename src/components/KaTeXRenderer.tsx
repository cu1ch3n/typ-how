import { useEffect, useRef, memo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useIsMobile } from '@/hooks/use-mobile';

interface KaTeXRendererProps {
  expression: string;
  displayMode?: boolean;
  className?: string;
  onClick?: () => void;
  isClickable?: boolean;
}

export const KaTeXRenderer = memo(({ 
  expression, 
  displayMode = false, 
  className = '',
  onClick,
  isClickable = false
}: KaTeXRendererProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (ref.current) {
      try {
        katex.render(expression, ref.current, {
          displayMode,
          throwOnError: false,
          trust: true,
          strict: false
        });
      } catch (error) {
        console.error('KaTeX rendering error:', error);
        ref.current.textContent = expression;
      }
    }
  }, [expression, displayMode]);

  return (
    <div 
      ref={ref} 
      className={`
        math-text select-text
        ${isMobile ? 'overflow-x-auto max-w-full' : ''}
        ${isClickable ? 'cursor-pointer hover:bg-highlight/20 rounded p-1 transition-colors' : ''}
        ${className}
      `}
      onClick={onClick}
      style={isMobile ? { scrollbarWidth: 'thin' } : undefined}
    />
  );
});