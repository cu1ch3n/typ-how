import { useState, useEffect } from 'react';
import { Settings, RotateCcw, Upload, FileCode, Plus, X, Eye, EyeOff, Trash2, Link, Share2, Copy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';

interface WasmSource {
  id: string;
  name: string;
  url: string;
  authType?: 'none' | 'bearer' | 'basic' | 'header' | 'presigned';
  authToken?: string;
  authHeader?: string;
  authUsername?: string;
  authPassword?: string;
  isLocal?: boolean;
  createdAt: number;
}

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWasmSourceChange: (source: WasmSource) => void;
}

const DEFAULT_WASM_URL = 'https://files.typ.how/zoo.wasm';
const STORAGE_KEY = 'wasm-sources';

const createDefaultSource = (): WasmSource => ({
  id: 'default',
  name: 'Type Inference Zoo (Default)',
  url: DEFAULT_WASM_URL,
  authType: 'none',
  isLocal: false,
  createdAt: Date.now()
});

export const SettingsModal = ({ open, onOpenChange, onWasmSourceChange }: SettingsModalProps) => {
  const [sources, setSources] = useState<WasmSource[]>([createDefaultSource()]);
  const [selectedSourceId, setSelectedSourceId] = useState('default');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [newSource, setNewSource] = useState<Partial<WasmSource>>({
    name: '',
    url: '',
    authType: 'none'
  });
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({
    new: false,
    newBasic: false,
    edit: false,
    editBasic: false
  });
  const [isDragOver, setIsDragOver] = useState(false);
  const [subscriptionUrl, setSubscriptionUrl] = useState('');

  // Load sources from localStorage on mount
  useEffect(() => {
    const savedSources = localStorage.getItem(STORAGE_KEY);
    if (savedSources) {
      try {
        const parsed = JSON.parse(savedSources);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSources(parsed);
          // Find the current source or use the first one
          const currentSource = parsed.find(s => s.url === localStorage.getItem('current-wasm-url')) || parsed[0];
          setSelectedSourceId(currentSource.id);
          // Don't call onWasmSourceChange here as the WASM source is already loaded in wasmInterface
        }
      } catch (error) {
        console.error('Failed to load sources:', error);
      }
    }
  }, []);

  const saveSettings = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
      const selectedSource = sources.find(s => s.id === selectedSourceId);
      if (selectedSource) {
        localStorage.setItem('current-wasm-url', selectedSource.url);
        onWasmSourceChange(selectedSource);
        
        // Dispatch custom event to notify AlgorithmContext
        window.dispatchEvent(new CustomEvent('wasmUrlChanged', { 
          detail: { url: selectedSource.url } 
        }));
      }
      onOpenChange(false);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    }
  };

  const addNewSource = () => {
    if (!newSource.name || !newSource.url) {
      toast.error('Please provide both name and URL');
      return;
    }
    

    
    const source: WasmSource = {
      id: Date.now().toString(),
      name: newSource.name,
      url: newSource.url,
      authType: newSource.authType || 'none',
      authToken: newSource.authToken,
      authHeader: newSource.authHeader,
      authUsername: newSource.authUsername,
      authPassword: newSource.authPassword,
      isLocal: false,
      createdAt: Date.now()
    };
    
    setSources(prev => [...prev, source]);
    setSelectedSourceId(source.id);
    setIsAddingNew(false);
    setNewSource({ name: '', url: '', authType: 'none' });
    toast.success('WASM source added');
  };

  const startEditing = (source: WasmSource) => {
    setEditingSourceId(source.id);
    setNewSource({
      name: source.name,
      url: source.url,
      authType: source.authType || 'none',
      authToken: source.authToken,
      authHeader: source.authHeader,
      authUsername: source.authUsername,
      authPassword: source.authPassword
    });
  };

  const updateSource = () => {
    if (!editingSourceId || !newSource.name || !newSource.url) {
      toast.error('Please provide both name and URL');
      return;
    }
    
    setSources(prev => prev.map(source => 
      source.id === editingSourceId 
        ? {
            ...source,
            name: newSource.name!,
            url: newSource.url!,
            authType: newSource.authType || 'none',
            authToken: newSource.authToken,
            authHeader: newSource.authHeader,
            authUsername: newSource.authUsername,
            authPassword: newSource.authPassword
          }
        : source
    ));
    
    setEditingSourceId(null);
    setNewSource({ name: '', url: '', authType: 'none' });
    toast.success('WASM source updated');
  };

  const cancelEditing = () => {
    setEditingSourceId(null);
    setNewSource({ name: '', url: '', authType: 'none' });
  };

  const deleteSource = (id: string) => {
    if (id === 'default') {
      toast.error('Cannot delete default source');
      return;
    }
    
    setSources(prev => prev.filter(s => s.id !== id));
    if (selectedSourceId === id) {
      setSelectedSourceId('default');
    }
    toast.success('WASM source deleted');
  };

  const clearAllSources = () => {
    setSources([createDefaultSource()]);
    setSelectedSourceId('default');
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('current-wasm-url');
    toast.success('All sources cleared');
  };

  const decodeSubscriptionUrl = (url: string): WasmSource | null => {
    try {
      // Try to extract base64 encoded data from URL
      let encodedData = url;
      
      // Check if it's infer:// protocol
      if (url.startsWith('infer://')) {
        encodedData = url.replace('infer://', '');
      }
      // Check if it's a URL with hash fragment
      else if (url.includes('#')) {
        encodedData = url.split('#')[1];
      }
      // Check if it's a URL with query parameter
      else if (url.includes('wasm=')) {
        const match = url.match(/wasm=([^&]+)/);
        if (match) {
          encodedData = decodeURIComponent(match[1]);
        }
      }
      
      // Decode base64
      const decodedData = atob(encodedData);
      const sourceData = JSON.parse(decodedData);
      
      // Validate required fields
      if (!sourceData.name || !sourceData.url) {
        throw new Error('Invalid URL format: missing name or url');
      }
      
      // Create source with validation
      const source: WasmSource = {
        id: Date.now().toString(),
        name: sourceData.name,
        url: sourceData.url,
        authType: sourceData.authType || 'none',
        authToken: sourceData.authToken,
        authHeader: sourceData.authHeader,
        authUsername: sourceData.authUsername,
        authPassword: sourceData.authPassword,
        isLocal: false,
        createdAt: Date.now()
      };
      
      return source;
    } catch (error) {
      console.error('Failed to decode URL:', error);
      return null;
    }
  };

  const handleSubscriptionImport = () => {
    if (!subscriptionUrl.trim()) {
      toast.error('Please enter a URL');
      return;
    }
    
    const decodedSource = decodeSubscriptionUrl(subscriptionUrl.trim());
    if (!decodedSource) {
      toast.error('Invalid URL format');
      return;
    }
    
    // Check if source already exists
    const existingSource = sources.find(s => s.url === decodedSource.url);
    if (existingSource) {
      toast.error('A source with this URL already exists');
      return;
    }
    
    setSources(prev => [...prev, decodedSource]);
    setSelectedSourceId(decodedSource.id);
    setSubscriptionUrl('');
    toast.success(`Imported WASM source: ${decodedSource.name}`);
  };

  const generateSubscriptionUrl = (source: WasmSource): string => {
    try {
      const data = {
        name: source.name,
        url: source.url,
        authType: source.authType,
        authToken: source.authToken,
        authHeader: source.authHeader,
        authUsername: source.authUsername,
        authPassword: source.authPassword
      };
      
      const encodedData = btoa(JSON.stringify(data));
      return `infer://${encodedData}`;
    } catch (error) {
      console.error('Failed to generate URL:', error);
      return '';
    }
  };

  const handleExportSource = async (source: WasmSource) => {
    if (source.isLocal) {
      toast.error('Cannot export local WASM files');
      return;
    }

    const subscriptionUrl = generateSubscriptionUrl(source);
    if (!subscriptionUrl) {
      toast.error('Failed to generate URL');
      return;
    }

    try {
      await navigator.clipboard.writeText(subscriptionUrl);
      toast.success('URL copied to clipboard');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleFile = (file: File) => {
    if (file && file.name.endsWith('.wasm')) {
      const url = URL.createObjectURL(file);
      const source: WasmSource = {
        id: Date.now().toString(),
        name: file.name,
        url,
        authType: 'none',
        isLocal: true,
        createdAt: Date.now()
      };
      setSources(prev => [...prev, source]);
      setSelectedSourceId(source.id);
      toast.success('Local WASM file loaded');
    } else {
      toast.error('Please select a valid .wasm file');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    event.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const selectedSource = sources.find(s => s.id === selectedSourceId);
  const hasChanges = selectedSourceId !== sources.find(s => s.url === localStorage.getItem('current-wasm-url'))?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[85vw] max-h-[80vh] overflow-hidden flex flex-col p-4">
        <DialogHeader className="flex-shrink-0 pb-2">
          <DialogTitle className="text-lg">WASM Sources</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* Current Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Select WASM Source</Label>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddingNew(!isAddingNew)}
                  className="h-7 text-xs"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={clearAllSources}
                  disabled={sources.length <= 1}
                  className="h-7 text-xs"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </Button>
              </div>
            </div>
            
            <RadioGroup value={selectedSourceId} onValueChange={setSelectedSourceId} className="space-y-1">
              {sources.map((source) => (
                <div key={source.id} className="flex items-start gap-2 p-2 border rounded overflow-hidden">
                  <RadioGroupItem value={source.id} id={source.id} className="mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <Label htmlFor={source.id} className="text-sm font-medium cursor-pointer block leading-tight">
                      {source.name} {source.isLocal && <span className="text-xs text-muted-foreground">(Local)</span>}
                    </Label>
                    <div className="text-xs text-muted-foreground font-mono overflow-hidden">
                      <div className="break-all line-clamp-1 max-w-full">
                        {source.url}
                      </div>
                    </div>
                    {source.authType !== 'none' && (
                      <span className="text-xs text-muted-foreground">
                        Auth: {source.authType}
                      </span>
                    )}
                   </div>
                   <div className="flex gap-0.5 flex-shrink-0">
                     {source.id !== 'default' && (
                       <Button
                         variant="ghost"
                         size="sm"
                         onClick={() => startEditing(source)}
                         className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                         title="Edit source"
                       >
                         <FileCode className="w-3 h-3" />
                       </Button>
                     )}
                     {!source.isLocal && (
                       <Button
                         variant="ghost"
                         size="sm"
                         onClick={() => handleExportSource(source)}
                         className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                         title="Export as URL"
                       >
                         <Share2 className="w-3 h-3" />
                       </Button>
                     )}
                     {source.id !== 'default' && (
                       <Button
                         variant="ghost"
                         size="sm"
                         onClick={() => deleteSource(source.id)}
                         className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                         title="Delete source"
                       >
                         <X className="w-3 h-3" />
                       </Button>
                     )}
                   </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Add/Edit Source Form */}
          {(isAddingNew || editingSourceId) && (
            <div className="space-y-3 p-3 border rounded bg-muted/50">
              <h4 className="text-sm font-medium">
                {editingSourceId ? 'Edit WASM Source' : 'Add New WASM Source'}
              </h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="new-name" className="text-xs">Name</Label>
                  <Input
                    id="new-name"
                    value={newSource.name || ''}
                    onChange={(e) => setNewSource(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="My WASM Module"
                    className="h-8 text-sm"
                  />
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="new-auth" className="text-xs">Authentication</Label>
                  <select
                    id="new-auth"
                    value={newSource.authType || 'none'}
                    onChange={(e) => setNewSource(prev => ({ ...prev, authType: e.target.value as any }))}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                  >
                    <option value="none">None</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="basic">Basic Auth</option>
                    <option value="header">Custom Header</option>
                    <option value="presigned">Pre-signed URL</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="new-url" className="text-xs">URL</Label>
                <Input
                  id="new-url"
                  value={newSource.url || ''}
                  onChange={(e) => setNewSource(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://your-domain.com/module.wasm"
                  className="font-mono h-8 text-sm"
                />
              </div>

              {newSource.authType === 'bearer' && (
                <div className="space-y-1">
                  <Label htmlFor="new-token" className="text-xs">Bearer Token</Label>
                  <div className="relative">
                    <Input
                      id="new-token"
                                              type={showTokens[editingSourceId ? 'edit' : 'new'] ? 'text' : 'password'}
                        value={newSource.authToken || ''}
                        onChange={(e) => setNewSource(prev => ({ ...prev, authToken: e.target.value }))}
                        placeholder="your-bearer-token"
                        className="font-mono pr-8 h-8 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowTokens(prev => ({ ...prev, [editingSourceId ? 'edit' : 'new']: !prev[editingSourceId ? 'edit' : 'new'] }))}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                      >
                        {showTokens[editingSourceId ? 'edit' : 'new'] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </Button>
                  </div>
                </div>
              )}

              {newSource.authType === 'basic' && (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label htmlFor="new-username" className="text-xs">Username</Label>
                    <Input
                      id="new-username"
                      value={newSource.authUsername || ''}
                      onChange={(e) => setNewSource(prev => ({ ...prev, authUsername: e.target.value }))}
                      placeholder="username"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-password" className="text-xs">Password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showTokens[editingSourceId ? 'editBasic' : 'newBasic'] ? 'text' : 'password'}
                        value={newSource.authPassword || ''}
                        onChange={(e) => setNewSource(prev => ({ ...prev, authPassword: e.target.value }))}
                        placeholder="password"
                        className="pr-8 h-8 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowTokens(prev => ({ ...prev, [editingSourceId ? 'editBasic' : 'newBasic']: !prev[editingSourceId ? 'editBasic' : 'newBasic'] }))}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                      >
                        {showTokens[editingSourceId ? 'editBasic' : 'newBasic'] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {newSource.authType === 'header' && (
                <div className="space-y-1">
                  <Label htmlFor="new-header" className="text-xs">Authorization Header</Label>
                  <Input
                    id="new-header"
                    value={newSource.authHeader || ''}
                    onChange={(e) => setNewSource(prev => ({ ...prev, authHeader: e.target.value }))}
                    placeholder="X-API-Key: your-api-key"
                    className="font-mono h-8 text-sm"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={editingSourceId ? updateSource : addNewSource} 
                  size="sm" 
                  className="h-7 text-xs"
                >
                  {editingSourceId ? 'Update Source' : 'Add Source'}
                </Button>
                <Button
                  variant="outline"
                  onClick={editingSourceId ? cancelEditing : () => setIsAddingNew(false)}
                  size="sm"
                  className="h-7 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <Separator className="my-3" />

          {/* URL Import */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Import from URL</Label>
            <p className="text-xs text-muted-foreground">
              Paste a URL that contains encoded WASM source information
            </p>
            <div className="flex gap-2">
              <Input
                value={subscriptionUrl}
                onChange={(e) => setSubscriptionUrl(e.target.value)}
                placeholder="infer://..."
                className="font-mono h-8 text-sm"
              />
              <Button
                onClick={handleSubscriptionImport}
                disabled={!subscriptionUrl.trim()}
                size="sm"
                className="h-8 text-xs"
              >
                <Link className="w-3 h-3" />
                Import
              </Button>
            </div>
          </div>

          <Separator className="my-3" />

          {/* File Upload */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Upload Local WASM File</Label>
            <div 
              className={`border-2 border-dashed rounded p-3 text-center transition-colors cursor-pointer ${
                isDragOver 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('wasm-file-input')?.click()}
            >
              <input
                type="file"
                accept=".wasm"
                onChange={handleFileUpload}
                className="hidden"
                id="wasm-file-input"
              />
              <div className="space-y-1">
                <div className="flex justify-center">
                  {isDragOver ? (
                    <Upload className="w-5 h-5 text-primary" />
                  ) : (
                    <FileCode className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium">
                    {isDragOver ? 'Drop WASM file here' : 'Drop WASM file or click to browse'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports .wasm files only
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Current Status */}
          {selectedSource && (
            <div className="bg-muted/50 p-2 rounded text-xs">
              <p className="text-muted-foreground">
                <strong>Selected:</strong> {selectedSource.name}
              </p>
              <p className="font-mono text-muted-foreground break-all">
                {selectedSource.url}
              </p>
              {selectedSource.authType !== 'none' && (
                <p className="text-muted-foreground">
                  Authentication: {selectedSource.authType}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 mt-4 gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            size="sm"
            className="h-8"
          >
            Cancel
          </Button>
          <Button
            onClick={saveSettings}
            disabled={!hasChanges}
            size="sm"
            className="h-8"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};