import { cn } from '@/lib/utils';
import { Loader } from 'lucide-react';

export interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
}

export const Spinner = ({ size = 'medium' }: SpinnerProps) => {
  const sizeClasses = {
    small: 'h-4 w-4',
    medium: 'h-8 w-8',
    large: 'h-12 w-12',
  };

  return (
    <Loader className={cn('animate-spin text-primary', sizeClasses[size])} />
  );
};
