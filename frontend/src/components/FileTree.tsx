import { useState, useEffect } from 'react';
import { Folder, File, ChevronRight, ChevronDown, FilePlus2, FolderPlus, RefreshCw } from 'lucide-react';


export interface FileNode {
  name: string;
  path: string;
  type: 'dir' | 'file';
  size?: number;
  children?: FileNode[];
}

export const FileTree = ({ onSelectFile }: { onSelectFile: (path: string) => void }) => {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/files');
      const data = await res.json();
      setTree(data.tree || []);
    } catch (e) {
      console.error('Failed to load file tree', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  return (
    <div className="flex flex-col h-full bg-bg1 text-text2 border-r border-border font-sans text-sm select-none">
      <div className="flex items-center px-4 py-3 justify-between uppercase text-xs font-bold border-b border-border text-text">
        <span>Files</span>
        <div className="flex items-center gap-2">
          <button className="hover:text-accent transition-colors"><FilePlus2 size={14} /></button>
          <button className="hover:text-accent transition-colors"><FolderPlus size={14} /></button>
          <button onClick={fetchFiles} className="hover:text-accent transition-colors"><RefreshCw size={14} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="text-center opacity-50 py-4 text-xs">Loading...</div>
        ) : (
          <TreeNode nodes={tree} depth={0} onSelect={onSelectFile} />
        )}
      </div>
    </div>
  );
};

const TreeNode = ({ nodes, depth, onSelect }: { nodes: FileNode[], depth: number, onSelect: (path: string) => void }) => {
  return (
    <div className="flex flex-col gap-[2px]">
      {nodes.map(node => (
        <FileTreeItem key={node.path} node={node} depth={depth} onSelect={onSelect} />
      ))}
    </div>
  );
};

const FileTreeItem = ({ node, depth, onSelect }: { node: FileNode, depth: number, onSelect: (path: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isDir = node.type === 'dir';

  const handleClick = () => {
    if (isDir) {
      setIsOpen(!isOpen);
    } else {
      onSelect(node.path);
    }
  };

  return (
    <div>
      <div 
        className="flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer hover:bg-bg3 transition-colors"
        style={{ paddingLeft: `${depth * 15 + 8}px` }}
        onClick={handleClick}
      >
        <span className="opacity-50">
          {isDir ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-3.5 inline-block"/>}
        </span>
        <span className="text-accent opacity-80">
          {isDir ? <Folder size={14} /> : <File size={14} />}
        </span>
        <span className="truncate">{node.name}</span>
      </div>
      {isDir && isOpen && node.children && (
        <TreeNode nodes={node.children} depth={depth + 1} onSelect={onSelect} />
      )}
    </div>
  );
};
