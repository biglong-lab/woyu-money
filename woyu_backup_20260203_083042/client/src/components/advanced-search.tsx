import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, X, Save, Settings } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface SearchFilter {
  id: string;
  name: string;
  field: string;
  operator: string;
  value: string;
  type: 'text' | 'number' | 'date' | 'select';
}

interface SavedSearch {
  id: string;
  name: string;
  filters: SearchFilter[];
  createdAt: string;
}

interface AdvancedSearchProps {
  onSearch: (filters: SearchFilter[]) => void;
  onClear: () => void;
  availableFields: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'select';
    options?: Array<{ value: string; label: string }>;
  }>;
}

export function AdvancedSearch({ onSearch, onClear, availableFields }: AdvancedSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<SearchFilter[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');

  // 新增篩選條件
  const addFilter = useCallback(() => {
    const newFilter: SearchFilter = {
      id: Date.now().toString(),
      name: '',
      field: availableFields[0]?.key || '',
      operator: 'contains',
      value: '',
      type: availableFields[0]?.type || 'text'
    };
    setFilters(prev => [...prev, newFilter]);
  }, [availableFields]);

  // 更新篩選條件
  const updateFilter = useCallback((id: string, updates: Partial<SearchFilter>) => {
    setFilters(prev => prev.map(filter => 
      filter.id === id ? { ...filter, ...updates } : filter
    ));
  }, []);

  // 移除篩選條件
  const removeFilter = useCallback((id: string) => {
    setFilters(prev => prev.filter(filter => filter.id !== id));
  }, []);

  // 執行搜尋
  const handleSearch = useCallback(() => {
    const activeFilters = filters.filter(f => f.field && f.value);
    
    // 如果有全域搜尋，加入到篩選條件中
    if (globalSearch.trim()) {
      const globalFilter: SearchFilter = {
        id: 'global-search',
        name: '全域搜尋',
        field: 'global',
        operator: 'contains',
        value: globalSearch.trim(),
        type: 'text'
      };
      activeFilters.unshift(globalFilter);
    }
    
    onSearch(activeFilters);
  }, [filters, globalSearch, onSearch]);

  // 清除搜尋
  const handleClear = useCallback(() => {
    setFilters([]);
    setGlobalSearch('');
    onClear();
  }, [onClear]);

  // 儲存搜尋條件
  const saveSearch = useCallback(() => {
    if (!saveSearchName.trim() || filters.length === 0) return;
    
    const newSavedSearch: SavedSearch = {
      id: Date.now().toString(),
      name: saveSearchName.trim(),
      filters: [...filters],
      createdAt: new Date().toISOString()
    };
    
    setSavedSearches(prev => [...prev, newSavedSearch]);
    setSaveSearchName('');
    
    // 在實際應用中，這裡應該保存到後端
    localStorage.setItem('savedSearches', JSON.stringify([...savedSearches, newSavedSearch]));
  }, [saveSearchName, filters, savedSearches]);

  // 載入已儲存的搜尋
  const loadSavedSearch = useCallback((savedSearch: SavedSearch) => {
    setFilters(savedSearch.filters);
    setIsOpen(true);
  }, []);

  // 獲取操作符選項
  const getOperatorOptions = (type: string) => {
    switch (type) {
      case 'number':
        return [
          { value: 'equals', label: '等於' },
          { value: 'gt', label: '大於' },
          { value: 'gte', label: '大於等於' },
          { value: 'lt', label: '小於' },
          { value: 'lte', label: '小於等於' },
          { value: 'between', label: '介於' }
        ];
      case 'date':
        return [
          { value: 'equals', label: '等於' },
          { value: 'after', label: '晚於' },
          { value: 'before', label: '早於' },
          { value: 'between', label: '介於' }
        ];
      default:
        return [
          { value: 'contains', label: '包含' },
          { value: 'equals', label: '等於' },
          { value: 'startsWith', label: '開始於' },
          { value: 'endsWith', label: '結束於' }
        ];
    }
  };

  return (
    <div className="space-y-4">
      {/* 全域搜尋 */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="搜尋項目名稱、分類、專案..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="pl-10"
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <Button onClick={handleSearch} variant="default">
          <Search className="h-4 w-4 mr-2" />
          搜尋
        </Button>
        <Button onClick={() => setIsOpen(!isOpen)} variant="outline">
          <Settings className="h-4 w-4 mr-2" />
          進階
        </Button>
      </div>

      {/* 已儲存的搜尋 */}
      {savedSearches.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Label className="text-sm text-muted-foreground">快速搜尋：</Label>
          {savedSearches.map((saved) => (
            <Badge
              key={saved.id}
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80"
              onClick={() => loadSavedSearch(saved)}
            >
              {saved.name}
            </Badge>
          ))}
        </div>
      )}

      {/* 進階搜尋面板 */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleContent>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">進階搜尋</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 篩選條件 */}
              {filters.map((filter, index) => {
                const fieldConfig = availableFields.find(f => f.key === filter.field);
                return (
                  <div key={filter.id} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-3">
                      <Label className="text-sm">欄位</Label>
                      <Select
                        value={filter.field}
                        onValueChange={(value) => {
                          const field = availableFields.find(f => f.key === value);
                          updateFilter(filter.id, { 
                            field: value,
                            type: field?.type || 'text'
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFields.map((field) => (
                            <SelectItem key={field.key} value={field.key}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-2">
                      <Label className="text-sm">條件</Label>
                      <Select
                        value={filter.operator}
                        onValueChange={(value) => updateFilter(filter.id, { operator: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getOperatorOptions(filter.type).map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-6">
                      <Label className="text-sm">值</Label>
                      {fieldConfig?.type === 'select' ? (
                        <Select
                          value={filter.value}
                          onValueChange={(value) => updateFilter(filter.id, { value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {fieldConfig.options?.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={filter.type === 'date' ? 'date' : filter.type === 'number' ? 'number' : 'text'}
                          value={filter.value}
                          onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                          placeholder="輸入搜尋值..."
                        />
                      )}
                    </div>

                    <div className="col-span-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeFilter(filter.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {/* 操作按鈕 */}
              <div className="flex justify-between">
                <div className="space-x-2">
                  <Button variant="outline" onClick={addFilter}>
                    + 新增條件
                  </Button>
                  <Button variant="outline" onClick={handleClear}>
                    清除全部
                  </Button>
                </div>

                <div className="flex gap-2">
                  <div className="flex gap-1">
                    <Input
                      placeholder="儲存搜尋名稱..."
                      value={saveSearchName}
                      onChange={(e) => setSaveSearchName(e.target.value)}
                      className="w-40"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={saveSearch}
                      disabled={!saveSearchName.trim() || filters.length === 0}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button onClick={handleSearch}>
                    執行搜尋
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* 活躍的篩選條件顯示 */}
      {(filters.length > 0 || globalSearch) && (
        <div className="flex flex-wrap gap-2 items-center">
          <Label className="text-sm text-muted-foreground">活躍篩選：</Label>
          {globalSearch && (
            <Badge variant="default">
              全域: {globalSearch}
              <X 
                className="h-3 w-3 ml-1 cursor-pointer" 
                onClick={() => setGlobalSearch('')}
              />
            </Badge>
          )}
          {filters.filter(f => f.value).map((filter) => {
            const field = availableFields.find(f => f.key === filter.field);
            return (
              <Badge key={filter.id} variant="secondary">
                {field?.label}: {filter.value}
                <X 
                  className="h-3 w-3 ml-1 cursor-pointer" 
                  onClick={() => removeFilter(filter.id)}
                />
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}