import {ImagePickCancelled} from './imagePickTypes';
import type {ImagePickSource, PickedImage} from './imagePickTypes';

export type {ImagePickSource, PickedImage};
export {ImagePickCancelled, isImagePickCancelled} from './imagePickTypes';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const MAX_BYTES = 10 * 1024 * 1024;

function guessName(file: File): string {
  if (file.name && file.name.trim()) {
    return file.name;
  }
  const ext =
    file.type === 'image/png'
      ? 'png'
      : file.type === 'image/webp'
        ? 'webp'
        : file.type === 'image/gif'
          ? 'gif'
          : 'jpg';
  return `archive-${Date.now()}.${ext}`;
}

/**
 * Web：用隐藏 file input。拍照走 capture=environment（手机浏览器会开相机）。
 */
export function pickImage(source: ImagePickSource): Promise<PickedImage> {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('当前环境不支持选择图片'));
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT;
    if (source === 'camera') {
      input.setAttribute('capture', 'environment');
    }
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.opacity = '0';

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      fn();
    };

    const onFocus = () => {
      window.setTimeout(() => {
        if (!input.files?.length) {
          finish(() => reject(new ImagePickCancelled()));
        }
      }, 400);
    };

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        finish(() => reject(new ImagePickCancelled()));
        return;
      }
      if (file.size > MAX_BYTES) {
        finish(() =>
          reject(Object.assign(new Error('图片超过 10MB，请换一张更小的照片'), {name: 'ImageTooLarge'})),
        );
        return;
      }
      finish(() =>
        resolve({
          file,
          name: guessName(file),
          mimeType: file.type || 'image/jpeg',
        }),
      );
    };

    document.body.appendChild(input);
    window.addEventListener('focus', onFocus);
    input.click();
  });
}
