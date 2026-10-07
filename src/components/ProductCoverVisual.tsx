import React, { useState } from 'react';
import { BookOpen, FileCheck2, GraduationCap } from 'lucide-react';
import { OfficialSubject } from '../types';

interface ProductCoverVisualProps {
  coverThumbnail: string;
  subject: OfficialSubject;
  type: 'pdf' | 'exam';
  auditorium: 'School' | 'University';
  pageNumber: number;
  className?: string;
}

export const ProductCoverVisual: React.FC<ProductCoverVisualProps> = ({
  coverThumbnail,
  subject,
  type,
  auditorium,
  pageNumber,
  className = 'h-40',
}) => {
  const [imgError, setImgError] = useState(false);

  const isCustomImage =
    !imgError &&
    (coverThumbnail.startsWith('data:image/') ||
      coverThumbnail.startsWith('blob:') ||
      coverThumbnail.startsWith('http'));

  const getPalette = (sub: OfficialSubject) => {
    switch (sub) {
      case 'Math':
        return 'from-[#0038A8] via-[#0052FF] to-[#1E293B]';
      case 'Physics':
        return 'from-[#1E1B4B] via-[#312E81] to-[#0F172A]';
      case 'Chemistry':
        return 'from-[#064E3B] via-[#047857] to-[#0F172A]';
      case 'Biology':
        return 'from-[#14532D] via-[#15803D] to-[#0F172A]';
      case 'Computer science':
        return 'from-[#0F172A] via-[#1E293B] to-[#334155]';
      case 'Economy':
        return 'from-[#78350F] via-[#B45309] to-[#1E293B]';
      default:
        return 'from-[#0F172A] via-[#0052FF] to-[#1E293B]';
    }
  };

  if (isCustomImage) {
    return (
      <div className={`relative overflow-hidden bg-slate-900 ${className}`}>
        <img
          src={coverThumbnail}
          alt={`${subject} ${type.toUpperCase()} First Page Cover`}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent flex items-end justify-between p-3 text-white text-xs">
          <span className="font-medium">
            {subject} · {auditorium}
          </span>
          <span className="font-mono tabular-nums">{pageNumber}p</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${getPalette(
        subject
      )} p-4 flex flex-col justify-between text-white ${className}`}
    >
      {/* Subtle geometric academic grid lines */}
      <svg
        className="absolute inset-0 w-full h-full opacity-15 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id={`grid-${subject}-${type}`} width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="0.7" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#grid-${subject}-${type})`} />
      </svg>

      <div className="relative z-10 flex items-center justify-between text-xs text-white/85">
        <span className="font-medium tracking-tight">
          {subject} · {auditorium}
        </span>
        <span className="font-mono tabular-nums">
          {type === 'exam' ? 'EXAM DOC' : `${pageNumber} PAGES`}
        </span>
      </div>

      <div className="relative z-10 flex items-center justify-between mt-auto pt-4">
        <div className="flex items-center gap-2 text-xs text-white/90">
          {type === 'exam' ? (
            <FileCheck2 className="w-4 h-4 shrink-0 text-emerald-300" />
          ) : (
            <BookOpen className="w-4 h-4 shrink-0 text-sky-300" />
          )}
          <span>C. ACADEMY Verified First Page</span>
        </div>
        <GraduationCap className="w-4 h-4 text-white/70" />
      </div>
    </div>
  );
};
