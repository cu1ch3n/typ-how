import { Github, Table2, Settings, ChevronDown, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './ThemeToggle';
import { useState } from 'react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { WasmSourceDropdown } from './WasmSourceDropdown';

import { SettingsModal } from './SettingsModal';
import { wasmInference } from '@/lib/wasmInterface';
import { useIsMobile } from '@/hooks/use-mobile';

export const Navbar = () => {

  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleWasmSourceChange = (source: any) => {
    // Update WASM source with authentication data
    (wasmInference as any).updateWasmSource(source);
  };

  const toggleCompareMode = () => {
    const url = new URL(window.location.href);
    const isCurrentlyCompare = url.searchParams.get('compare') === 'true';
    
    if (isCurrentlyCompare) {
      url.searchParams.delete('compare');
    } else {
      url.searchParams.set('compare', 'true');
    }
    
    window.history.pushState({}, '', url.toString());
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // Check current mode
  const isCompareMode = new URL(window.location.href).searchParams.get('compare') === 'true';

  return (
    <nav className="border-b border-border bg-background/95 backdrop-blur-sm flex-shrink-0">
      <div className="px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Logo and Title - Left aligned */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground font-bold text-xs">λ</span>
            </div>
            <h1 className="text-base font-semibold min-w-0">
              <button
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.search = '';
                  window.history.pushState({}, '', url.toString());
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="hover:text-primary transition-colors block text-left"
              >
                Type Inference Playground
              </button>
            </h1>
          </div>
          
          {/* Navigation Items - Right aligned */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Mode Toggle */}
            <Button
              variant="outline"
              onClick={toggleCompareMode}
              className="btn-interactive"
              size="sm"
            >
              {isCompareMode ? (
                <>
                  <Play className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline text-xs">Playground</span>
                </>
              ) : (
                <>
                  <Table2 className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline text-xs">Comparison</span>
                </>
              )}
            </Button>



            {/* Theme Toggle */}
            <ThemeToggle />

            {/* GitHub Links Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="btn-interactive"
                  size="sm"
                >
                  <Github className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem 
                  onClick={() => window.open('https://github.com/cu1ch3n/typ-how', '_blank')}
                >
                  <Github className="w-4 h-4 mr-2" />
                  typ.how
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => window.open('https://github.com/cu1ch3n/type-inference-zoo-wasm', '_blank')}
                >
                  <Github className="w-4 h-4 mr-2" />
                  Type Inference Zoo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* WASM Source Dropdown - Quick switching */}
            <WasmSourceDropdown 
              onWasmSourceChange={handleWasmSourceChange}
              onOpenSettings={() => setSettingsModalOpen(true)}
            />
          </div>
        </div>
      </div>

      <SettingsModal 
        open={settingsModalOpen} 
        onOpenChange={setSettingsModalOpen}
        onWasmSourceChange={handleWasmSourceChange} 
      />
    </nav>
  );
};