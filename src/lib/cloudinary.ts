/**
 * Cloudinary configuration and upload helper
 */

export const CLOUDINARY_CONFIG = {
  cloudName: 'detzzicfz',
  uploadPreset: 'profiles_assists',
};

export interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
  format: string;
}

/**
 * Upload an image to Cloudinary
 * @param file - The file to upload
 * @param folder - Optional folder name in Cloudinary
 * @returns Promise with the upload response
 */
export async function uploadToCloudinary(
  file: File,
  folder?: string
): Promise<CloudinaryUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  
  if (folder) {
    formData.append('folder', folder);
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Error al subir la imagen');
  }

  return response.json();
}

/**
 * Generate a Cloudinary URL with transformations
 * @param publicId - The public ID of the image
 * @param transformations - Optional transformations (e.g., 'w_150,h_150,c_fill')
 * @returns The transformed image URL
 */
export function getCloudinaryUrl(
  publicId: string,
  transformations?: string
): string {
  const baseUrl = `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
  
  if (transformations) {
    return `${baseUrl}/${transformations}/${publicId}`;
  }
  
  return `${baseUrl}/${publicId}`;
}
