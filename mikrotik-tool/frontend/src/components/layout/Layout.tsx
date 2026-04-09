import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { LogPanel } from './LogPanel';
import { useLogStore } from '../../store/logStore';

export function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isOpen: logPanelOpen } = useLogStore();

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
          <Outlet />
        </main>
        {logPanelOpen && <LogPanel />}
      </div>
    </div>
  );
}
