import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Filter, X, Calendar, AlertTriangle, Clock, Tag, Building2, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface FilterConfig {
  projects?: { id: number; projectName: string }[];
  categories?: { id: number; categoryName: string }[];
  statuses?: { value: string; label: string }[];
  priorities?: { value: number; label: string }[];
}

export interface ActiveFilters {
  search: string;
  projects: number[];
  categories: number[];
  statuses: string[];
  priorities: number[];
  dueDateRange: 'all' | '7days' | '30days' | '90days' | 'overdue';
}

export interface UnifiedSearchFilterProps {
  config: FilterConfig;
  onFilterChange: (filters: ActiveFilters) => void;
  placeholder?: string;
  showDueDateFilter?: boolean;
  className?: string;
}

const defaultStatuses = [
  { value: 'pending', label: '待付款' },
  { value: 'partial', label: '部分付款' },
  { value: 'paid', label: '已付款' },
  { value: 'overdue', label: '逾期' },
];

const defaultPriorities = [
  { value: 1, label: '最低' },
  { value: 2, label: '低' },
  { value: 3, label: '中' },
  { value: 4, label: '高' },
  { value: 5, label: '最高' },
];

const dueDateOptions = [
  { value: 'all', label: '全部日期' },
  { value: '7days', label: '7天內到期' },
  { value: '30days', label: '30天內到期' },
  { value: '90days', label: '90天內到期' },
  { value: 'overdue', label: '已逾期' },
];

export default function UnifiedSearchFilter({
  config,
  onFilterChange,
  placeholder = '搜尋項目名稱、專案、備註...',
  showDueDateFilter = true,
  className = '',
}: UnifiedSearchFilterProps) {
  const [search, setSearch] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<number[]>([]);
  const [dueDateRange, setDueDateRange] = useState<'all' | '7days' | '30days' | '90days' | 'overdue'>('all');
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const statuses = config.statuses || defaultStatuses;
  const priorities = config.priorities || defaultPriorities;

  const activeFilters: ActiveFilters = useMemo(() => ({
    search,
    projects: selectedProjects,
    categories: selectedCategories,
    statuses: selectedStatuses,
    priorities: selectedPriorities,
    dueDateRange,
  }), [search, selectedProjects, selectedCategories, selectedStatuses, selectedPriorities, dueDateRange]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedProjects.length > 0) count++;
    if (selectedCategories.length > 0) count++;
    if (selectedStatuses.length > 0) count++;
    if (selectedPriorities.length > 0) count++;
    if (dueDateRange !== 'all') count++;
    return count;
  }, [selectedProjects, selectedCategories, selectedStatuses, selectedPriorities, dueDateRange]);

  useEffect(() => {
    const handler = setTimeout(() => {
      onFilterChange(activeFilters);
    }, 300);
    return () => clearTimeout(handler);
  }, [activeFilters, onFilterChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('[data-testid="unified-search-input"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }
      if (e.key === 'Escape') {
        setSearch('');
        clearAllFilters();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearch('');
    setSelectedProjects([]);
    setSelectedCategories([]);
    setSelectedStatuses([]);
    setSelectedPriorities([]);
    setDueDateRange('all');
  }, []);

  const toggleProject = (projectId: number) => {
    setSelectedProjects(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const toggleCategory = (categoryId: number) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const togglePriority = (priority: number) => {
    setSelectedPriorities(prev =>
      prev.includes(priority)
        ? prev.filter(p => p !== priority)
        : [...prev, priority]
    );
  };

  const removeFilter = (type: string, value?: string | number) => {
    switch (type) {
      case 'project':
        setSelectedProjects(prev => prev.filter(id => id !== value));
        break;
      case 'category':
        setSelectedCategories(prev => prev.filter(id => id !== value));
        break;
      case 'status':
        setSelectedStatuses(prev => prev.filter(s => s !== value));
        break;
      case 'priority':
        setSelectedPriorities(prev => prev.filter(p => p !== value));
        break;
      case 'dueDate':
        setDueDateRange('all');
        break;
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            data-testid="unified-search-input"
            type="text"
            placeholder={placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-20"
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
            Ctrl+K
          </div>
        </div>

        <Popover open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="relative" data-testid="btn-advanced-filter">
              <Filter className="h-4 w-4 mr-2" />
              篩選
              {activeFilterCount > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">進階篩選</h4>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters} data-testid="btn-clear-filters">
                    <X className="h-4 w-4 mr-1" />
                    清除全部
                  </Button>
                )}
              </div>

              {config.projects && config.projects.length > 0 && (
                <div>
                  <label className="text-sm font-medium flex items-center mb-2">
                    <Building2 className="h-4 w-4 mr-2" />
                    專案
                  </label>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {config.projects.map((project) => (
                      <Badge
                        key={project.id}
                        variant={selectedProjects.includes(project.id) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleProject(project.id)}
                        data-testid={`filter-project-${project.id}`}
                      >
                        {project.projectName}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {config.categories && config.categories.length > 0 && (
                <div>
                  <label className="text-sm font-medium flex items-center mb-2">
                    <Tag className="h-4 w-4 mr-2" />
                    分類
                  </label>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {config.categories.map((category) => (
                      <Badge
                        key={category.id}
                        variant={selectedCategories.includes(category.id) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleCategory(category.id)}
                        data-testid={`filter-category-${category.id}`}
                      >
                        {category.categoryName}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium flex items-center mb-2">
                  <Clock className="h-4 w-4 mr-2" />
                  狀態
                </label>
                <div className="flex flex-wrap gap-1">
                  {statuses.map((status) => (
                    <Badge
                      key={status.value}
                      variant={selectedStatuses.includes(status.value) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleStatus(status.value)}
                      data-testid={`filter-status-${status.value}`}
                    >
                      {status.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium flex items-center mb-2">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  優先級
                </label>
                <div className="flex flex-wrap gap-1">
                  {priorities.map((priority) => (
                    <Badge
                      key={priority.value}
                      variant={selectedPriorities.includes(priority.value) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => togglePriority(priority.value)}
                      data-testid={`filter-priority-${priority.value}`}
                    >
                      {priority.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {showDueDateFilter && (
                <div>
                  <label className="text-sm font-medium flex items-center mb-2">
                    <Calendar className="h-4 w-4 mr-2" />
                    到期時間
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {dueDateOptions.map((option) => (
                      <Badge
                        key={option.value}
                        variant={dueDateRange === option.value ? 'default' : 'outline'}
                        className={`cursor-pointer ${
                          option.value === 'overdue' ? 'bg-red-100 hover:bg-red-200 text-red-800' :
                          option.value === '7days' ? 'bg-orange-100 hover:bg-orange-200 text-orange-800' :
                          option.value === '30days' ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800' : ''
                        }`}
                        onClick={() => setDueDateRange(option.value as typeof dueDateRange)}
                        data-testid={`filter-due-${option.value}`}
                      >
                        {option.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {(search || activeFilterCount > 0) && (
          <Button variant="ghost" size="icon" onClick={clearAllFilters} data-testid="btn-clear-all">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {(selectedProjects.length > 0 || selectedCategories.length > 0 || selectedStatuses.length > 0 || selectedPriorities.length > 0 || dueDateRange !== 'all') && (
        <div className="flex flex-wrap gap-2">
          {selectedProjects.map((projectId) => {
            const project = config.projects?.find(p => p.id === projectId);
            return project ? (
              <Badge key={`project-${projectId}`} variant="secondary" className="pl-2 pr-1">
                <Building2 className="h-3 w-3 mr-1" />
                {project.projectName}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-1 hover:bg-transparent"
                  onClick={() => removeFilter('project', projectId)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ) : null;
          })}
          
          {selectedCategories.map((categoryId) => {
            const category = config.categories?.find(c => c.id === categoryId);
            return category ? (
              <Badge key={`category-${categoryId}`} variant="secondary" className="pl-2 pr-1">
                <Tag className="h-3 w-3 mr-1" />
                {category.categoryName}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-1 hover:bg-transparent"
                  onClick={() => removeFilter('category', categoryId)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ) : null;
          })}
          
          {selectedStatuses.map((status) => {
            const statusInfo = statuses.find(s => s.value === status);
            return statusInfo ? (
              <Badge key={`status-${status}`} variant="secondary" className="pl-2 pr-1">
                <Clock className="h-3 w-3 mr-1" />
                {statusInfo.label}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-1 hover:bg-transparent"
                  onClick={() => removeFilter('status', status)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ) : null;
          })}
          
          {selectedPriorities.map((priority) => {
            const priorityInfo = priorities.find(p => p.value === priority);
            return priorityInfo ? (
              <Badge key={`priority-${priority}`} variant="secondary" className="pl-2 pr-1">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {priorityInfo.label}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-1 hover:bg-transparent"
                  onClick={() => removeFilter('priority', priority)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ) : null;
          })}
          
          {dueDateRange !== 'all' && (
            <Badge variant="secondary" className={`pl-2 pr-1 ${
              dueDateRange === 'overdue' ? 'bg-red-100 text-red-800' :
              dueDateRange === '7days' ? 'bg-orange-100 text-orange-800' :
              dueDateRange === '30days' ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-800'
            }`}>
              <Calendar className="h-3 w-3 mr-1" />
              {dueDateOptions.find(o => o.value === dueDateRange)?.label}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-1 hover:bg-transparent"
                onClick={() => removeFilter('dueDate')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export function applyFilters<T extends {
  itemName?: string;
  projectName?: string;
  categoryName?: string;
  notes?: string;
  projectId?: number;
  categoryId?: number;
  status?: string;
  priority?: number;
  startDate?: string;
  endDate?: string;
}>(items: T[], filters: ActiveFilters): T[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const in7Days = new Date(today);
  in7Days.setDate(in7Days.getDate() + 7);
  
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);

  const in90Days = new Date(today);
  in90Days.setDate(in90Days.getDate() + 90);

  return items.filter(item => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch = 
        item.itemName?.toLowerCase().includes(searchLower) ||
        item.projectName?.toLowerCase().includes(searchLower) ||
        item.categoryName?.toLowerCase().includes(searchLower) ||
        item.notes?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    if (filters.projects.length > 0 && item.projectId) {
      if (!filters.projects.includes(item.projectId)) return false;
    }

    if (filters.categories.length > 0 && item.categoryId) {
      if (!filters.categories.includes(item.categoryId)) return false;
    }

    if (filters.statuses.length > 0 && item.status) {
      if (!filters.statuses.includes(item.status)) return false;
    }

    if (filters.priorities.length > 0 && item.priority) {
      if (!filters.priorities.includes(item.priority)) return false;
    }

    if (filters.dueDateRange !== 'all') {
      const dueDate = item.endDate ? new Date(item.endDate) : item.startDate ? new Date(item.startDate) : null;
      if (dueDate) {
        dueDate.setHours(0, 0, 0, 0);
        switch (filters.dueDateRange) {
          case 'overdue':
            if (dueDate >= today) return false;
            break;
          case '7days':
            if (dueDate < today || dueDate > in7Days) return false;
            break;
          case '30days':
            if (dueDate < today || dueDate > in30Days) return false;
            break;
          case '90days':
            if (dueDate < today || dueDate > in90Days) return false;
            break;
        }
      }
    }

    return true;
  });
}
