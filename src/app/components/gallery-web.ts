import { WebPlugin } from '@capacitor/core';

export class GalleryWeb extends WebPlugin {
  async saveToGallery(options: { base64Data: string; fileName: string }): Promise<{ success: boolean; message?: string }> {
    // Web fallback: use download
    try {
      const dataUrl = `data:image/png;base64,${options.base64Data}`;
      const link = document.createElement('a');
      link.download = options.fileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return { success: true, message: 'Image downloaded' };
    } catch (error) {
      return { success: false, message: String(error) };
    }
  }
}

