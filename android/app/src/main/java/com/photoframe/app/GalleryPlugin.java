package com.photoframe.app;

import android.content.ContentValues;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.WebView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

@CapacitorPlugin(name = "Gallery")
public class GalleryPlugin extends Plugin {

    @PluginMethod
    public void saveToGallery(PluginCall call) {
        String base64Data = call.getString("base64Data");
        String fileName = call.getString("fileName", "photo-frame-" + System.currentTimeMillis() + ".png");

        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("Base64 data is required");
            return;
        }

        try {
            // Remove data URL prefix if present
            if (base64Data.contains(",")) {
                base64Data = base64Data.split(",")[1];
            }

            // Decode base64 to bitmap
            byte[] decodedBytes = Base64.decode(base64Data, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.length);

            if (bitmap == null) {
                call.reject("Failed to decode image");
                return;
            }

            Context context = getContext();
            boolean success = false;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ (API 29+): Use MediaStore
                success = saveImageToGalleryQ(context, bitmap, fileName);
            } else {
                // Android 9 and below: Use MediaStore with file path
                success = saveImageToGalleryLegacy(context, bitmap, fileName);
            }

            if (success) {
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("message", "Image saved to gallery");
                call.resolve(result);
            } else {
                call.reject("Failed to save image to gallery");
            }
        } catch (Exception e) {
            call.reject("Error saving image: " + e.getMessage());
        }
    }

    private boolean saveImageToGalleryQ(Context context, Bitmap bitmap, String fileName) {
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
        values.put(MediaStore.MediaColumns.MIME_TYPE, "image/png");
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/PhotoFrame");

        Uri uri = context.getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        if (uri == null) {
            return false;
        }

        try (OutputStream outputStream = context.getContentResolver().openOutputStream(uri)) {
            if (outputStream != null) {
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream);
                return true;
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
        return false;
    }

    private boolean saveImageToGalleryLegacy(Context context, Bitmap bitmap, String fileName) {
        File picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES);
        File photoFrameDir = new File(picturesDir, "PhotoFrame");
        if (!photoFrameDir.exists()) {
            photoFrameDir.mkdirs();
        }

        File imageFile = new File(photoFrameDir, fileName);
        try (FileOutputStream fos = new FileOutputStream(imageFile)) {
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, fos);
            fos.flush();

            // Add to MediaStore
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DATA, imageFile.getAbsolutePath());
            values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
            values.put(MediaStore.Images.Media.TITLE, fileName);
            values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
            context.getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            return true;
        } catch (IOException e) {
            e.printStackTrace();
            return false;
        }
    }
}

