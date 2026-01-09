import React, { useState, useEffect } from 'react';
import { FileText, X, Download, Trash2, Filter } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { logger, LogLevel, LogEntry } from '../utils/logger';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export const LogViewer = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'ALL'>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (isOpen) {
      updateLogs();
      if (autoRefresh) {
        const interval = setInterval(updateLogs, 1000);
        return () => clearInterval(interval);
      }
    }
  }, [isOpen, filterLevel, filterCategory, autoRefresh]);

  const updateLogs = () => {
    let filteredLogs: LogEntry[] = [];
    
    if (filterLevel === 'ALL') {
      filteredLogs = logger.getLogs();
    } else {
      filteredLogs = logger.getLogs(filterLevel);
    }
    
    if (filterCategory !== 'ALL') {
      filteredLogs = filteredLogs.filter(log => log.category === filterCategory);
    }
    
    setLogs(filteredLogs);
  };

  const categories = Array.from(new Set(logs.map(log => log.category)));

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case LogLevel.ERROR:
        return 'text-red-600 bg-red-50';
      case LogLevel.WARN:
        return 'text-yellow-600 bg-yellow-50';
      case LogLevel.INFO:
        return 'text-blue-600 bg-blue-50';
      case LogLevel.DEBUG:
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  const handleDownload = () => {
    logger.downloadLogs();
  };

  const handleClear = () => {
    if (confirm('确定要清空所有日志吗？')) {
      logger.clearLogs();
      updateLogs();
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 shadow-lg"
      >
        <FileText className="w-4 h-4 mr-2" />
        查看日志
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>日志查看器</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4 mr-2" />
                  导出
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  清空
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-2 mb-4 px-6">
            <Select value={filterLevel} onValueChange={(value) => setFilterLevel(value as LogLevel | 'ALL')}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">所有级别</SelectItem>
                <SelectItem value={LogLevel.DEBUG}>DEBUG</SelectItem>
                <SelectItem value={LogLevel.INFO}>INFO</SelectItem>
                <SelectItem value={LogLevel.WARN}>WARN</SelectItem>
                <SelectItem value={LogLevel.ERROR}>ERROR</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">所有分类</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? '自动刷新: 开' : '自动刷新: 关'}
            </Button>
          </div>

          <div className="flex-1 overflow-auto border rounded-lg p-4 bg-stone-50 mx-6">
            {logs.length === 0 ? (
              <div className="text-center text-stone-500 py-8">
                暂无日志
              </div>
            ) : (
              <div className="space-y-2 font-mono text-xs">
                {logs.slice().reverse().map((log, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded border-l-4 ${
                      log.level === LogLevel.ERROR ? 'border-red-500' :
                      log.level === LogLevel.WARN ? 'border-yellow-500' :
                      log.level === LogLevel.INFO ? 'border-blue-500' :
                      'border-gray-500'
                    } bg-white`}
                  >
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getLevelColor(log.level)}`}>
                        {log.level}
                      </span>
                      <span className="text-stone-400">{formatTime(log.timestamp)}</span>
                      <span className="text-stone-600 font-semibold">[{log.category}]</span>
                      <span className="flex-1 min-w-0 break-words">{log.message}</span>
                    </div>
                    {log.data && (
                      <details className="mt-2 ml-2">
                        <summary className="cursor-pointer text-stone-500 hover:text-stone-700">
                          查看详情
                        </summary>
                        <pre className="mt-2 p-2 bg-stone-100 rounded text-xs overflow-auto max-h-40">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-xs text-stone-500 mt-2 px-6 pb-2">
            共 {logs.length} 条日志
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

