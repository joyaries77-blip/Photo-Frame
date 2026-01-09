import React, { useRef, useState, useEffect } from 'react';
import { toPng } from 'html-to-image';
import exifr from 'exifr';
import { Upload, Download, Camera, Aperture, Type, Smartphone, Image as ImageIcon, Settings2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';
import { toast } from 'sonner';
import { Card, CardContent } from './ui/card';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { registerPlugin } from '@capacitor/core';

// Register custom Gallery plugin
const Gallery = registerPlugin<any>('Gallery', {
  web: () => import('./gallery-web').then(m => new m.GalleryWeb()),
});

// Types for our app
interface ExifData {
  make?: string;
  model?: string;
  dateTime?: string;
  exposureTime?: number;
  fNumber?: number;
  iso?: number;
  focalLength?: number;
  lensModel?: string;
}

interface FrameConfig {
  bgColor: string;
  textColor: string;
  padding: number;
  shadow: boolean;
  border: boolean;
  aspectRatio: string; // 'auto', '1:1', '4:5', '9:16'
  showExif: boolean;
  showDevice: boolean;
  showLens: boolean;
  customDevice: string;
  customSystem: string;
  customLens: string;
  photographer: string;
}

const PhotoFrame = () => {
  const [imageSrc,Ql] = useState<string | null>(null);
  const [exifData, setExifData] = useState<ExifData | null>(null);
  const [config, setConfig] = useState<FrameConfig>({
    bgColor: '#fbfbf9', // Cream/Off-white
    textColor: '#292524', // Stone-800
    padding: 24,
    shadow: true,
    border: false,
    aspectRatio: 'auto',
    showExif: true,
    showDevice: true,
    showLens: true,
    customDevice: '',
    customSystem: '',
    customLens: '',
    photographer: '',
  });
  
  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      // Convert file to data URL for better compatibility with html-to-image
      const reader = new FileReader();
      const url = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      Ql(url);

      // Parse EXIF
      const exif = await exifr.parse(file, {
        tiff: true,
        xmp: true,
        icc: false,
      });

      console.log('Parsed EXIF:', exif);

      if (exif) {
        setExifData({
          make: exif.Make,
          model: exif.Model,
          dateTime: exif.DateTimeOriginal ? new Date(exif.DateTimeOriginal).toLocaleDateString() : undefined,
          exposureTime: exif.ExposureTime,
          fNumber: exif.FNumber,
          iso: exif.ISO,
          focalLength: exif.FocalLength,
          lensModel: exif.LensModel,
        });

        // Auto-fill custom fields if available
        let deviceName = exif.Model || '';
        if (exif.Make && !deviceName.toLowerCase().includes(exif.Make.toLowerCase())) {
          deviceName = `${exif.Make} ${deviceName}`;
        }
        
        setConfig(prev => ({
          ...prev,
          customDevice: deviceName,
          customLens: exif.LensModel || '',
          customSystem: exif.Software || '', 
        }));
      } else {
        setExifData({});
        toast.info("No EXIF data found in this image.");
      }
    } catch (error) {
      console.error("Error parsing image:", error);
      toast.error("Failed to load image metadata.");
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = async () => {
    if (cardRef.current === null) {
      return;
    }

    try {
      setLoading(true);
      
      // Wait for all images to load before generating PNG
      const images = cardRef.current.querySelectorAll('img');
      const imagePromises = Array.from(images).map((img: HTMLImageElement) => {
        return new Promise<void>((resolve) => {
          // Check if image is already loaded
          if (img.complete && img.naturalHeight !== 0) {
            console.log("Image already loaded:", img.src.substring(0, 50));
            resolve();
            return;
          }
          
          // If image src is a data URL, it should load quickly
          if (img.src.startsWith('data:')) {
            console.log("Image is data URL, should load quickly");
            // Give it a moment to decode
            setTimeout(() => resolve(), 100);
            return;
          }
          
          // Wait for image to load
          const onLoad = () => {
            console.log("Image loaded successfully");
            img.removeEventListener('load', onLoad);
            img.removeEventListener('error', onError);
            resolve();
          };
          
          const onError = (e: Event) => {
            console.error("Image load error:", e);
            img.removeEventListener('load', onLoad);
            img.removeEventListener('error', onError);
            // Still resolve to allow PNG generation even if image fails
            resolve();
          };
          
          img.addEventListener('load', onLoad);
          img.addEventListener('error', onError);
          
          // Timeout after 3 seconds
          setTimeout(() => {
            console.warn("Image load timeout");
            img.removeEventListener('load', onLoad);
            img.removeEventListener('error', onError);
            resolve();
          }, 3000);
        });
      });
      
      await Promise.all(imagePromises);
      console.log("All images loaded, generating PNG...");
      
      // Small delay to ensure rendering is complete
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // We scale up for better quality
      let dataUrl: string;
      try {
        dataUrl = await toPng(cardRef.current, { 
          cacheBust: true, 
          pixelRatio: 2,
          // Use CORS and allow taint for better compatibility
          useCORS: true,
          allowTaint: true,
          // Add filter to handle blob URLs
          filter: (node) => {
            // Skip script and style tags
            if (node.nodeName === 'SCRIPT' || node.nodeName === 'STYLE') {
              return false;
            }
            return true;
          }
        });
      } catch (pngError: any) {
        console.error("toPng error:", pngError);
        console.error("toPng error type:", typeof pngError);
        console.error("toPng error constructor:", pngError?.constructor?.name);
        
        let errorMsg = "图片生成失败";
        
        if (pngError) {
          // Handle Event objects specifically
          if (pngError instanceof Event) {
            errorMsg = "图片生成被中断，请重试";
            console.error("Event object detected in toPng:", pngError.type, pngError.target);
          } else if (typeof pngError === 'string') {
            errorMsg = pngError;
          } else if (pngError.message) {
            errorMsg = pngError.message;
          } else if (pngError.toString && typeof pngError.toString === 'function') {
            const str = pngError.toString();
            // Check if toString returns [object Event] or similar
            if (str === '[object Event]' || str.startsWith('[object ')) {
              errorMsg = "图片生成失败，请重试";
            } else {
              errorMsg = str;
            }
          } else {
            try {
              const jsonStr = JSON.stringify(pngError);
              if (jsonStr === '{}' || jsonStr === 'null') {
                errorMsg = "图片生成失败，请重试";
              } else {
                errorMsg = jsonStr;
              }
            } catch {
              errorMsg = "图片生成失败，请重试";
            }
          }
        }
        
        const safePngErrorMsg = String(errorMsg || "图片生成失败");
        console.error("Final toPng error message:", safePngErrorMsg);
        toast.error(safePngErrorMsg);
        setLoading(false);
        return;
      }
      
      // Check if running on native platform (Android/iOS)
      if (Capacitor.isNativePlatform()) {
        // For Android, always use web download since Filesystem plugin is not properly registered
        const platform = Capacitor.getPlatform();
        if (platform === 'android') {
          console.log("Android platform detected, using Gallery plugin");
          try {
            // Extract base64 data from data URL
            const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
            const fileName = `photo-frame-${Date.now()}.png`;
            
            const result = await Gallery.saveToGallery({
              base64Data: base64Data,
              fileName: fileName
            });
            
            if (result.success) {
              toast.success("图片已保存到相册！");
            } else {
              throw new Error(result.message || "保存失败");
            }
            setLoading(false);
            return;
          } catch (galleryError: any) {
            console.error("Gallery plugin failed, falling back to web download:", galleryError);
            // Fallback to web download
            try {
              const link = document.createElement('a');
              link.download = `photo-frame-${Date.now()}.png`;
              link.href = dataUrl;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              toast.success("图片已保存！请查看下载文件夹");
            } catch (webError: any) {
              console.error("Web download also failed:", webError);
              toast.error("保存失败，请重试");
            }
            setLoading(false);
            return;
          }
        }
        
        // For iOS or other platforms - try native Filesystem if available
        // Check if Filesystem plugin is available
        let filesystemAvailable = false;
        try {
          // Try to check if Filesystem is available
          if (Filesystem && typeof Filesystem.writeFile === 'function') {
            filesystemAvailable = true;
          }
        } catch (e) {
          console.log("Filesystem plugin not available, using web download");
        }
        
        if (!filesystemAvailable) {
          // Fallback to web download
          console.log("Using web download fallback");
          try {
            const link = document.createElement('a');
            link.download = `photo-frame-${Date.now()}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("图片已保存！请查看下载文件夹");
            setLoading(false);
            return;
          } catch (webError: any) {
            console.error("Web download failed:", webError);
            toast.error("保存失败，请重试");
            setLoading(false);
            return;
          }
        }
        
        // Extract base64 data from data URL
        const base64Data = dataUrl.split(',')[1];
        const timestamp = Date.now();
        const fileName = `photo-frame-${timestamp}.png`;
        
        console.log("Attempting to save image on native platform...");
        
        try {
          // For Android, try saving to DCIM/Pictures directory (visible in gallery)
          // Use a simpler path structure
          const savePath = `Pictures/PhotoFrame/${fileName}`;
          
          console.log("Trying to save to:", savePath);
          
          await Filesystem.writeFile({
            path: savePath,
            data: base64Data,
            directory: Directory.ExternalStorage,
            recursive: true
          });
          
          console.log("Successfully saved to ExternalStorage");
          toast.success("图片已保存到相册！");
        } catch (fsError: any) {
          console.error("ExternalStorage failed:", fsError);
          let fsErrorMsg = "外部存储失败";
          if (fsError) {
            if (typeof fsError === 'string') {
              fsErrorMsg = fsError;
            } else if (fsError.message) {
              fsErrorMsg = fsError.message;
            } else {
              try {
                fsErrorMsg = JSON.stringify(fsError);
              } catch {
                fsErrorMsg = "外部存储访问失败";
              }
            }
          }
          console.error("ExternalStorage error details:", fsErrorMsg);
          
          // Try Documents directory
          try {
            const docPath = `PhotoFrame/${fileName}`;
            console.log("Trying Documents directory:", docPath);
            
            await Filesystem.writeFile({
              path: docPath,
              data: base64Data,
              directory: Directory.Documents,
              recursive: true
            });
            
            console.log("Successfully saved to Documents");
            toast.success("图片已保存到文档文件夹！");
          } catch (docError: any) {
            console.error("Documents failed:", docError);
            let docErrorMsg = "文档目录失败";
            if (docError) {
              if (typeof docError === 'string') {
                docErrorMsg = docError;
              } else if (docError.message) {
                docErrorMsg = docError.message;
              } else {
                try {
                  docErrorMsg = JSON.stringify(docError);
                } catch {
                  docErrorMsg = "文档目录访问失败";
                }
              }
            }
            console.error("Documents error details:", docErrorMsg);
            
            // Try Cache directory, then use Share API
            try {
              const cachePath = fileName;
              console.log("Trying Cache directory:", cachePath);
              
              const fileResult = await Filesystem.writeFile({
                path: cachePath,
                data: base64Data,
                directory: Directory.Cache,
                recursive: true
              });
              
              console.log("Successfully saved to Cache, trying to share:", fileResult.uri);
              
              // Try to share/save using Share API
              try {
                await Share.share({
                  title: '保存照片',
                  text: 'Photo Frame 照片',
                  url: fileResult.uri,
                  dialogTitle: '保存照片到相册'
                });
                toast.success("请选择保存位置！");
              } catch (shareError: any) {
                console.log("Share failed, file saved to cache:", shareError);
                let shareErrorMsg = "分享功能不可用";
                if (shareError) {
                  if (typeof shareError === 'string') {
                    shareErrorMsg = shareError;
                  } else if (shareError.message) {
                    shareErrorMsg = shareError.message;
                  }
                }
                console.log("Share error:", shareErrorMsg);
                toast.success("图片已保存（应用缓存）！");
              }
            } catch (cacheError: any) {
              console.error("All save methods failed:", cacheError);
              let errorMsg = "未知错误";
              
              if (cacheError) {
                if (typeof cacheError === 'string') {
                  errorMsg = cacheError;
                } else if (cacheError.message) {
                  errorMsg = cacheError.message;
                } else if (cacheError.toString && typeof cacheError.toString === 'function') {
                  errorMsg = cacheError.toString();
                } else {
                  try {
                    errorMsg = JSON.stringify(cacheError);
                  } catch {
                    errorMsg = "保存失败，请检查存储权限";
                  }
                }
              }
              
              console.error("Full error details:", errorMsg);
              
              // Last resort: try to share the data URL directly
              try {
                await Share.share({
                  title: '保存照片',
                  text: 'Photo Frame 照片',
                  url: dataUrl
                });
                toast.success("请选择保存位置！");
              } catch (shareError: any) {
                console.error("Share also failed:", shareError);
                let finalErrorMsg = errorMsg;
                if (shareError) {
                  if (typeof shareError === 'string') {
                    finalErrorMsg = shareError;
                  } else if (shareError.message) {
                    finalErrorMsg = shareError.message;
                  } else {
                    try {
                      finalErrorMsg = JSON.stringify(shareError);
                    } catch {
                      finalErrorMsg = errorMsg;
                    }
                  }
                }
                const safeFinalErrorMsg = String(finalErrorMsg || "操作失败");
                toast.error(`保存失败：${safeFinalErrorMsg}。请检查存储权限设置。`);
              }
            }
          }
        }
      } else {
        // Web platform - use traditional download
        try {
          const link = document.createElement('a');
          link.download = `photo-frame-${Date.now()}.png`;
          link.href = dataUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          toast.success("Image saved to album!");
        } catch (webError: any) {
          console.error("Web download error:", webError);
          let webErrorMsg = "下载失败";
          if (webError) {
            if (typeof webError === 'string') {
              webErrorMsg = webError;
            } else if (webError.message) {
              webErrorMsg = webError.message;
            } else {
              try {
                webErrorMsg = JSON.stringify(webError);
              } catch {
                webErrorMsg = "下载失败，请重试";
              }
            }
          }
          const safeWebErrorMsg = String(webErrorMsg || "下载失败");
          toast.error(safeWebErrorMsg);
        }
      }
    } catch (err: any) {
      console.error("Download error:", err);
      console.error("Error type:", typeof err);
      console.error("Error constructor:", err?.constructor?.name);
      
      let errorMsg = "未知错误";
      
      if (err) {
        // Handle Event objects specifically
        if (err instanceof Event) {
          errorMsg = `操作被取消或中断`;
          console.error("Event object detected:", err.type, err.target);
        } else if (typeof err === 'string') {
          errorMsg = err;
        } else if (err.message) {
          errorMsg = err.message;
        } else if (err.toString && typeof err.toString === 'function') {
          const str = err.toString();
          // Check if toString returns [object Event] or similar
          if (str === '[object Event]' || str.startsWith('[object ')) {
            errorMsg = "操作失败，请重试";
          } else {
            errorMsg = str;
          }
        } else {
          try {
            const jsonStr = JSON.stringify(err);
            if (jsonStr === '{}' || jsonStr === 'null') {
              errorMsg = "操作失败，请重试";
            } else {
              errorMsg = jsonStr;
            }
          } catch {
            errorMsg = "操作失败，请重试";
          }
        }
      }
      
      console.error("Final error message:", errorMsg);
      // Ensure errorMsg is always a string
      const safeErrorMsg = String(errorMsg || "操作失败，请重试");
      toast.error(`保存失败：${safeErrorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  // Helper to format shutter speed
  const formatShutterSpeed = (t?: number) => {
    if (!t) return '';
    if (t >= 1) return `${t}s`;
    return `1/${Math.round(1/t)}`;
  };

  return (
    <div className="min-h-screen bg-stone-100 pb-20 md:pb-10 font-sans text-stone-800">
      
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-md bg-stone-100/80 border-b border-stone-200 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-stone-600" />
          <h1 className="font-serif text-xl font-medium tracking-tight">Lens & Frame</h1>
        </div>
        <Button 
          variant="default" 
          size="sm" 
          onClick={downloadImage}
          disabled={!imageSrc}
          className="bg-stone-800 hover:bg-stone-700 text-stone-50"
        >
          <Download className="w-4 h-4 mr-2" />
          Save
        </Button>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Left Col: The Preview */}
        <div className="md:col-span-7 lg:col-span-8 flex flex-col items-center justify-center min-h-[50vh] md:min-h-[80vh]">
          
          {!imageSrc ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-md aspect-[4/5] rounded-xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center cursor-pointer hover:border-stone-400 hover:bg-stone-50 transition-colors"
            >
              <div className="p-4 rounded-full bg-stone-200 mb-4">
                <Upload className="w-8 h-8 text-stone-500" />
              </div>
              <p className="text-stone-500 font-medium">Tap to upload photo</p>
              <p className="text-stone-400 text-sm mt-1">Supports JPG, PNG with EXIF</p>
            </div>
          ) : (
            <div className="w-full flex justify-center items-center overflow-auto p-4 md:p-8">
               {/* This is the capture target */}
               <div 
                  ref={cardRef}
                  className={`relative flex flex-col items-center mx-auto transition-all duration-300 ease-in-out`}
                  style={{ 
                    backgroundColor: config.bgColor,
                    padding: `${config.padding}px`,
                    boxShadow: config.shadow ? '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' : 'none',
                    maxWidth: '100%',
                    minWidth: '320px' 
                  }}
               >
                  {/* Image Container */}
                  <div className={`relative w-full mb-6 ${config.border ? 'p-1 border border-current opacity-90' : ''}`}>
                    <img 
                      src={imageSrc}  
                      alt="Preview" 
                      className="block w-full h-auto object-contain"
                      style={{ maxHeight: '70vh' }} 
                    />
                  </div>

                  {/* Metadata Section */}
                  <div 
                    className="w-full flex flex-col gap-4 px-2"
                    style={{ color: config.textColor }}
                  >
                    
                    {/* Top Row: Device & System */}
                    {(config.showDevice || config.customSystem) && (
                      <div className="flex flex-col items-center text-center font-serif tracking-wide">
                         {config.showDevice && config.customDevice && (
                           <h2 className="text-lg md:text-xl font-bold uppercase tracking-widest mb-1">
                             {config.customDevice}
                           </h2>
                         )}
                         {config.customSystem && (
                           <span className="text-xs md:text-sm opacity-60 uppercase tracking-widest">
                             {config.customSystem}
                           </span>
                         )}
                      </div>
                    )}

                    {/* Divider if needed */}
                    {(config.showDevice || config.customSystem) && (config.showLens || config.showExif) && (
                      <div className="w-8 h-[1px] bg-current opacity-30 mx-auto my-1"></div>
                    )}

                    {/* Middle Row: Lens Info */}
                    {config.showLens && config.customLens && (
                      <div className="text-center font-serif italic text-sm md:text-base opacity-80">
                        {config.customLens}
                      </div>
                    )}

                    {/* Bottom Row: Tech Specs */}
                    {config.showExif && (
                      <div className="flex flex-wrap justify-center gap-4 text-xs md:text-sm font-mono opacity-60 uppercase tracking-wider mt-1">
                        {exifData?.focalLength && (
                          <span className="flex items-center">
                            {Math.round(exifData.focalLength)}mm
                          </span>
                        )}
                        {exifData?.fNumber && (
                          <span className="flex items-center">
                            f/{exifData.fNumber}
                          </span>
                        )}
                        {exifData?.exposureTime && (
                          <span className="flex items-center">
                            {formatShutterSpeed(exifData.exposureTime)}
                          </span>
                        )}
                        {exifData?.iso && (
                          <span className="flex items-center">
                            ISO {exifData.iso}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* Photographer / Date */}
                    {config.photographer && (
                       <div className="mt-4 text-center text-xs font-serif italic opacity-40">
                          Captured by {config.photographer}
                       </div>
                    )}

                  </div>
               </div>
            </div>
          )}
        </div>

        {/* Right Col: Controls */}
        <div className="md:col-span-5 lg:col-span-4 space-y-6">
          <Card>
            <CardContent className="p-5 space-y-6">
              
              {/* Actions */}
              <div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()} 
                  variant="outline" 
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {imageSrc ? 'Replace Photo' : 'Upload Photo'}
                </Button>
              </div>
              
              <Separator />

              {/* Text Inputs */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Type className="w-4 h-4" />
                  <h3 className="font-medium text-sm">Metadata</h3>
                </div>
                
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="device" className="text-xs uppercase text-stone-500">Device Model</Label>
                    <Input 
                      id="device" 
                      value={config.customDevice} 
                      onChange={(e) => setConfig({...config, customDevice: e.target.value})}
                      placeholder="e.g. iPhone 15 Pro"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="system" className="text-xs uppercase text-stone-500">System / OS</Label>
                    <Input 
                      id="system" 
                      value={config.customSystem} 
                      onChange={(e) => setConfig({...config, customSystem: e.target.value})}
                      placeholder="e.g. iOS 17.2"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lens" className="text-xs uppercase text-stone-500">Lens / Accessories</Label>
                    <Input 
                      id="lens" 
                      value={config.customLens} 
                      onChange={(e) => setConfig({...config, customLens: e.target.value})}
                      placeholder="e.g. Moment 58mm Tele"
                    />
                  </div>

                   <div className="space-y-2">
                    <Label htmlFor="photographer" className="text-xs uppercase text-stone-500">Photographer</Label>
                    <Input 
                      id="photographer" 
                      value={config.photographer} 
                      onChange={(e) => setConfig({...config, photographer: e.target.value})}
                      placeholder="e.g. Your Name"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Toggles */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Settings2 className="w-4 h-4" />
                  <h3 className="font-medium text-sm">Display Options</h3>
                </div>

                <div className="flex items-center justify-between">
                   <Label htmlFor="show-exif" className="text-sm font-normal">Show Tech Specs (ISO, etc)</Label>
                   <Switch 
                    id="show-exif" 
                    checked={config.showExif} 
                    onCheckedChange={(c) => setConfig({...config, showExif: c})}
                   />
                </div>
                
                <div className="flex items-center justify-between">
                   <Label htmlFor="show-shadow" className="text-sm font-normal">Frame Shadow</Label>
                   <Switch 
                    id="show-shadow" 
                    checked={config.shadow} 
                    onCheckedChange={(c) => setConfig({...config, shadow: c})}
                   />
                </div>

                <div className="flex items-center justify-between">
                   <Label htmlFor="show-border" className="text-sm font-normal">Image Border</Label>
                   <Switch 
                    id="show-border" 
                    checked={config.border} 
                    onCheckedChange={(c) => setConfig({...config, border: c})}
                   />
                </div>
              </div>

              <Separator />

              {/* Style Sliders */}
               <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label className="text-xs uppercase text-stone-500">Padding</Label>
                      <span className="text-xs text-stone-400">{config.padding}px</span>
                    </div>
                    <Slider 
                      value={[config.padding]} 
                      min={0} 
                      max={100} 
                      step={4} 
                      onValueChange={(val) => setConfig({...config, padding: val[0]})} 
                    />
                  </div>
               </div>

               {/* Colors */}
               <div className="space-y-2">
                  <Label className="text-xs uppercase text-stone-500">Theme</Label>
                  <div className="flex gap-2">
                    {[
                      { bg: '#fbfbf9', text: '#292524', name: 'Classic' },
                      { bg: '#ffffff', text: '#000000', name: 'White' },
                      { bg: '#1c1917', text: '#fafaf9', name: 'Dark' },
                      { bg: '#e7e5e4', text: '#44403c', name: 'Stone' },
                    ].map((theme) => (
                      <button
                        key={theme.name}
                        onClick={() => setConfig({...config, bgColor: theme.bg, textColor: theme.text})}
                        className={`w-8 h-8 rounded-full border border-stone-200 shadow-sm transition-transform active:scale-95 ${config.bgColor === theme.bg ? 'ring-2 ring-stone-400' : ''}`}
                        style={{ backgroundColor: theme.bg }}
                        title={theme.name}
                      />
                    ))}
                  </div>
               </div>

            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export { PhotoFrame };
