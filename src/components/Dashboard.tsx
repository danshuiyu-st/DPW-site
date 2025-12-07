import React, { useEffect, useState } from 'react';
import { db, WaferProject } from '../db';
import { Icons } from './Icons';
import { Folder, Trash2, Search, Package, User } from 'lucide-react';

interface DashboardProps {
  onOpen: (id: number) => void;
  onNew: () => void;
}

export default function Dashboard({ onOpen, onNew }: DashboardProps) {
  const [projects, setProjects] = useState<WaferProject[]>([]);
  const [currentPath, setCurrentPath] = useState<string[]>([]); // ["Owner", "Product"]
  
  // State to force re-render
  const [tick, setTick] = useState(0);

  useEffect(() => {
    db.projects.orderBy('updatedAt').reverse().toArray().then(setProjects);
  }, [tick]);

  const handleDelete = async (e: React.MouseEvent, id?: number) => {
    e.stopPropagation();
    if (id && confirm('Are you sure you want to delete this project?')) {
      await db.projects.delete(id);
      setTick(t => t+1);
    }
  };
  
  // File System Logic
  const getItemsInPath = () => {
    const depth = currentPath.length;
    const folders = new Set<string>();
    const files: WaferProject[] = [];

    projects.forEach(p => {
      const parts = p.folderPath ? p.folderPath.split('/') : ['Uncategorized'];
      // Normalize path parts
      const cleanParts = parts.map(s => s.trim()).filter(Boolean);
      
      // Check if project belongs in current path
      let match = true;
      for(let i=0; i<depth; i++) {
        if (cleanParts[i] !== currentPath[i]) {
            match = false; break;
        }
      }
      
      if (match) {
        if (cleanParts.length > depth) {
            folders.add(cleanParts[depth]);
        } else {
            files.push(p);
        }
      }
    });

    return { folders: Array.from(folders).sort(), files };
  };

  const { folders, files } = getItemsInPath();

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
             <div className="bg-indigo-600 p-2 rounded-lg text-white"><Icons.Disc /></div>
             <div>
                <h1 className="text-xl font-bold text-slate-800">WaferMap Pro</h1>
                <p className="text-xs text-slate-500">Project Management Dashboard</p>
             </div>
        </div>
        <button onClick={onNew} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all">
            <Icons.Plus /> New Project
        </button>
      </div>

      {/* Breadcrumbs */}
      <div className="px-8 py-4 flex items-center gap-2 text-sm text-slate-600 bg-white border-b border-gray-100">
         <button onClick={() => setCurrentPath([])} className={`hover:text-indigo-600 font-medium flex items-center gap-1 ${currentPath.length===0?'text-indigo-600':''}`}>
            <Icons.Home /> Home
         </button>
         {currentPath.map((folder, idx) => (
            <React.Fragment key={folder}>
                <span className="text-slate-300">/</span>
                <button onClick={() => setCurrentPath(currentPath.slice(0, idx+1))} className={`hover:text-indigo-600 font-medium ${idx===currentPath.length-1?'text-indigo-600':''}`}>
                    {folder}
                </button>
            </React.Fragment>
         ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8 custom-scroll">
         {folders.length === 0 && files.length === 0 && (
             <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <Package size={48} className="mb-4 opacity-20"/>
                <p>No projects found in this folder.</p>
                {currentPath.length === 0 && <p className="text-sm mt-2">Click "New Project" to start.</p>}
             </div>
         )}

         {/* Folders Grid */}
         {folders.length > 0 && (
            <div className="mb-8">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Folders</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {folders.map(f => (
                        <div key={f} onClick={() => setCurrentPath([...currentPath, f])} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all flex items-center gap-3 group">
                            <div className="text-yellow-400 group-hover:scale-110 transition-transform"><Folder fill="currentColor" size={24}/></div>
                            <span className="font-medium text-slate-700 truncate">{f}</span>
                        </div>
                    ))}
                </div>
            </div>
         )}

         {/* Files Grid */}
         {files.length > 0 && (
            <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Projects</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {files.map(p => (
                        <div key={p.id} onClick={() => p.id && onOpen(p.id)} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-xl hover:border-indigo-400 transition-all group cursor-pointer relative flex flex-col h-[280px]">
                            {/* Thumbnail */}
                            <div className="h-40 bg-slate-900 relative overflow-hidden flex items-center justify-center border-b border-gray-100">
                                {p.thumbnail ? (
                                    <img src={p.thumbnail} alt={p.name} className="w-full h-full object-contain opacity-90 group-hover:scale-105 transition-transform duration-500" />
                                ) : (
                                    <Icons.Disc />
                                )}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => handleDelete(e, p.id)} className="bg-white/90 p-1.5 rounded-full text-red-500 hover:bg-red-500 hover:text-white transition-colors shadow-lg">
                                        <Trash2 size={14}/>
                                    </button>
                                </div>
                            </div>
                            
                            {/* Content */}
                            <div className="p-4 flex-1 flex flex-col">
                                <h4 className="font-bold text-slate-800 text-lg mb-1 truncate" title={p.name}>{p.name}</h4>
                                <div className="text-xs text-slate-400 mb-3 flex items-center gap-1">
                                    <User size={10}/> {p.owner || 'Unknown'} &bull; {new Date(p.updatedAt).toLocaleDateString()}
                                </div>
                                
                                <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-xs text-slate-600 mt-auto">
                                    <div className="flex justify-between"><span>Wafer:</span> <span className="font-mono font-semibold">{p.meta.waferSize}mm</span></div>
                                    <div className="flex justify-between"><span>Good:</span> <span className="font-mono font-semibold text-emerald-600">{p.meta.goodDie}</span></div>
                                    <div className="flex justify-between"><span>Pitch:</span> <span className="font-mono">{p.meta.dieSize}</span></div>
                                    <div className="flex justify-between"><span>Yield:</span> <span className="font-mono font-bold text-indigo-600">{p.meta.yield}</span></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
         )}
      </div>
    </div>
  );
}