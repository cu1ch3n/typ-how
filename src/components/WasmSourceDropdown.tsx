import { useState, useEffect } from 'react';
import { ChevronDown, Settings, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface WasmSource {
  id: string;
  name: string;
  url: string;
  authType?: 'none' | 'bearer' | 'basic' | 'header' | 'presigned';
  isLocal?: boolean;
  createdAt: number;
}

interface WasmSourceDropdownProps {
  onWasmSourceChange: (source: WasmSource) => void;
  onOpenSettings: () => void;
}

const STORAGE_KEY = 'wasm-sources';

export const WasmSourceDropdown = ({ onWasmSourceChange, onOpenSettings }: WasmSourceDropdownProps) => {
  const [sources, setSources] = useState<WasmSource[]>([]);
  const [currentSourceId, setCurrentSourceId] = useState<string>('default');

  // Load sources from localStorage
  useEffect(() => {
    const savedSources = localStorage.getItem(STORAGE_KEY);
    if (savedSources) {
      try {
        const parsed = JSON.parse(savedSources);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSources(parsed);
          // Find the current source
          const currentUrl = localStorage.getItem('current-wasm-url');
          const currentSource = parsed.find(s => s.url === currentUrl) || parsed[0];
          setCurrentSourceId(currentSource.id);
        }
      } catch (error) {
        console.error('Failed to load sources:', error);
      }
    } else {
      // Create default source if none exist
      const defaultSource: WasmSource = {
        id: 'default',
        name: 'Type Inference Zoo (Default)',
        url: 'https://files.typ.how/zoo.wasm',
        authType: 'none',
        isLocal: false,
        createdAt: Date.now()
      };
      setSources([defaultSource]);
      setCurrentSourceId('default');
    }
  }, []);

  // Listen for changes to sources (when settings modal updates them)
  useEffect(() => {
    const handleStorageChange = () => {
      const savedSources = localStorage.getItem(STORAGE_KEY);
      if (savedSources) {
        try {
          const parsed = JSON.parse(savedSources);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSources(parsed);
            const currentUrl = localStorage.getItem('current-wasm-url');
            const currentSource = parsed.find(s => s.url === currentUrl) || parsed[0];
            setCurrentSourceId(currentSource.id);
          }
        } catch (error) {
          console.error('Failed to load sources:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    // Also listen for custom event when WASM URL changes
    window.addEventListener('wasmUrlChanged', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('wasmUrlChanged', handleStorageChange);
    };
  }, []);

  const handleSourceSelect = (source: WasmSource) => {
    setCurrentSourceId(source.id);
    localStorage.setItem('current-wasm-url', source.url);
    onWasmSourceChange(source);
    
    // Dispatch custom event to notify AlgorithmContext
    window.dispatchEvent(new CustomEvent('wasmUrlChanged', { 
      detail: { url: source.url } 
    }));
  };

  const currentSource = sources.find(s => s.id === currentSourceId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="btn-interactive min-w-0"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
            <span className="truncate text-xs">
              WASM
            </span>
            <ChevronDown className="w-3 h-3 flex-shrink-0" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          WASM Sources
        </div>
        <DropdownMenuSeparator />
        
        {sources.map((source) => (
          <DropdownMenuItem
            key={source.id}
            onClick={() => handleSourceSelect(source)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {source.name}
                  {source.isLocal && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      Local
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate font-mono">
                  {source.url}
                </div>
                {source.authType !== 'none' && (
                  <div className="text-xs text-muted-foreground">
                    Auth: {source.authType}
                  </div>
                )}
              </div>
            </div>
            {currentSourceId === source.id && (
              <Check className="w-4 h-4 text-primary flex-shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onOpenSettings}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Settings className="w-4 h-4" />
          <span>Manage Sources</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
