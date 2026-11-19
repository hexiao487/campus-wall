'use client';

/**
 * 上传前在浏览器里把图片压小：最长边不超过 1600，体积尽量压到 1MB 以内。
 * 失败（比如浏览器不支持 canvas）时原样返回，不阻断上传。
 */
export async function compressImage(file, { maxBytes = 1024 * 1024, maxSide = 1600 } = {}) {
  if (!file || !file.type || !file.type.startsWith('image/')) return file;
  if (file.type === 'image/gif') return file; // 动图不重编码
  if (file.size <= maxBytes) return file;

  let bitmap = null;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    bitmap = null;
  }

  if (!bitmap) {
    // 老浏览器兜底：走 Image + objectURL
    bitmap = await new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }
  if (!bitmap) return file;

  const w = bitmap.width || 0;
  const h = bitmap.height || 0;
  if (!w || !h) return file;

  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (bitmap.close) bitmap.close();

  const blob = await new Promise((resolve) => {
    let quality = 0.86;
    const tick = () => {
      canvas.toBlob(
        (b) => {
          if (!b) return resolve(null);
          if (b.size <= maxBytes || quality <= 0.42) return resolve(b);
          quality -= 0.12;
          tick();
        },
        'image/jpeg',
        quality
      );
    };
    tick();
  });

  if (!blob || blob.size > file.size) return file;

  const name = (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}

export default compressImage;
