import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import WaferMapEditor from './components/WaferMapEditor';

export default function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'editor'>('dashboard');
  const [projectId, setProjectId] = useState<number | undefined>(undefined);

  const handleOpenProject = (id: number) => {
    setProjectId(id);
    setCurrentView('editor');
  };

  const handleNewProject = () => {
    setProjectId(undefined);
    setCurrentView('editor');
  };

  const handleBack = () => {
    setProjectId(undefined);
    setCurrentView('dashboard');
  };

  return (
    <div className="h-screen w-screen overflow-hidden">
      {currentView === 'dashboard' ? (
        <Dashboard onOpen={handleOpenProject} onNew={handleNewProject} />
      ) : (
        <WaferMapEditor projectId={projectId} onBack={handleBack} />
      )}
    </div>
  );
}