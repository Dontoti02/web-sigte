'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, UploadCloud, X } from 'lucide-react';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { useToast } from '@/hooks/use-toast';

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageUploaded: (url: string) => void;
  folder?: string;
  className?: string;
  fallbackText?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'square';
}

const sizeClasses = {
  sm: 'h-16 w-16',
  md: 'h-24 w-24',
  lg: 'h-32 w-32',
  xl: 'h-40 w-40',
};

export function ImageUpload({
  currentImageUrl,
  onImageUploaded,
  folder = 'uploads',
  className = '',
  fallbackText = 'U',
  size = 'lg',
  shape = 'circle',
}: ImageUploadProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Archivo inválido',
        description: 'Por favor selecciona una imagen válida.',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Archivo muy grande',
        description: 'La imagen no debe superar los 5MB.',
      });
      return;
    }

    // Show preview
    setPreviewUrl(URL.createObjectURL(file));

    // Upload to Cloudinary
    setIsUploading(true);
    try {
      const result = await uploadToCloudinary(file, folder);
      onImageUploaded(result.secure_url);
      // Clear preview after successful upload - the parent will update currentImageUrl
      setPreviewUrl(null);
      toast({
        title: 'Imagen subida',
        description: 'La imagen se ha subido correctamente.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al subir imagen',
        description: error.message || 'Ocurrió un error inesperado.',
      });
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearPreview = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const displayUrl = previewUrl || currentImageUrl;

  return (
    <div className={`relative group ${className}`}>
      <Avatar className={`${sizeClasses[size]} ${shape === 'square' ? 'rounded-lg' : ''} border-4 border-primary`}>
        <AvatarImage src={displayUrl} alt="Upload preview" />
        <AvatarFallback className={size === 'xl' ? 'text-4xl' : size === 'lg' ? 'text-3xl' : 'text-xl'}>
          {fallbackText}
        </AvatarFallback>
      </Avatar>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png, image/jpeg, image/jpg, image/gif, image/webp"
        className="hidden"
        disabled={isUploading}
      />

      <div className="absolute bottom-0 right-0 flex gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="rounded-full h-10 w-10 bg-background/80 hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          aria-label="Subir imagen"
        >
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
        </Button>

        {previewUrl && !isUploading && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-full h-10 w-10 bg-background/80 hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleClearPreview}
            aria-label="Cancelar"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
