import { useState } from 'react';
import { Dropdown } from './Dropdown';
import { Project } from '../types/Project';

interface ProjectCardProps {
  project: Project;
  onRename: (project: Project) => void;
  onDelete: (id: string) => void;
  onOpen: (project: Project) => void;
}

export const ProjectCard = ({ project, onRename, onDelete, onOpen }: ProjectCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };


  return (
    <div
      className="shadow-sm border transition-all duration-200 cursor-pointer group"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border-secondary)',
        boxShadow: 'var(--shadow-sm)',
        minWidth: '280px',
        display: 'flex',
        flexDirection: 'column'
      }}
      data-component="project-card"
      onMouseEnter={() => {
        setIsHovered(true);
        // Add hover shadow
        const target = event?.currentTarget as HTMLElement;
        if (target) target.style.boxShadow = 'var(--shadow-md)';
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        // Remove hover shadow
        const target = event?.currentTarget as HTMLElement;
        if (target) target.style.boxShadow = 'var(--shadow-sm)';
      }}
      onClick={() => onOpen(project)}
    >
      {/* Thumbnail */}
      <div className="relative" data-section="thumbnail">
        {project.thumbnail ? (
          <img
            src={project.thumbnail}
            alt={project.name}
            className="w-full object-cover"
            style={{
              height: '160px'
            }}
            onError={(e) => {
              console.warn('Failed to load thumbnail for project:', project.name);
              // Hide the broken image and show fallback
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.setAttribute('style', 'display: flex');
            }}
            onLoad={() => {
              console.log('Thumbnail loaded successfully for project:', project.name);
            }}
          />
        ) : null}
        
        {/* Fallback thumbnail - shown when no thumbnail or when image fails to load */}
        <div 
          style={{ 
            display: project.thumbnail ? 'none' : 'flex',
            backgroundColor: '#6B7280',
            height: '160px' 
          }}
          className="w-full flex items-center justify-center text-white text-xl font-bold"
        >
          {project.name.charAt(0).toUpperCase()}
        </div>
        
        {/* Hover overlay with kebab menu */}
        {isHovered && (
          <div 
            className="absolute top-2 right-2"
            onClick={(e) => e.stopPropagation()}
            data-control="actions-menu"
          >
            <Dropdown
              trigger={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-bg-primary)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              }
              options={[
                {
                  value: 'rename',
                  label: 'Rename',
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  )
                },
                {
                  value: 'delete',
                  label: 'Delete',
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )
                }
              ]}
              value=""
              onChange={(action) => {
                if (action === 'rename') {
                  onRename(project);
                } else if (action === 'delete') {
                  onDelete(project.id);
                }
              }}
              align="right"
            />
          </div>
        )}
      </div>

      {/* Project info */}
      <div className="p-4 flex flex-col gap-2" data-section="info">
        <h3 className="font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
          {project.name}
        </h3>
        
        <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }} data-info="date">
          Updated {formatDate(project.updatedAt)}
        </div>

      </div>
    </div>
  );
};