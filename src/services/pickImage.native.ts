import {NativeModules, PermissionsAndroid, Platform} from 'react-native';
import {ImagePickCancelled, isImagePickCancelled} from './imagePickTypes';
import type {ImagePickSource, PickedImage} from './imagePickTypes';

export type {ImagePickSource, PickedImage};
export {ImagePickCancelled, isImagePickCancelled} from './imagePickTypes';

type NativeImagePicker = {
  pick: (source: string) => Promise<{uri: string; type: string; name: string}>;
};

const native = NativeModules.ImagePicker as NativeImagePicker | undefined;

function requireNative(): NativeImagePicker {
  if (!native?.pick) {
    throw Object.assign(new Error('原生选图模块未就绪，请重新编译 Android 应用'), {
      name: 'NativeModuleMissing',
    });
  }
  return native;
}

async function requestCameraPermission(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
    title: '允许使用相机',
    message: '拍照识别就诊单需要使用相机。',
    buttonPositive: '允许',
    buttonNegative: '取消',
  });
  if (result !== PermissionsAndroid.RESULTS.GRANTED) {
    throw Object.assign(new Error('未获得相机权限，请在系统设置中允许后重试'), {
      name: 'NotAllowedError',
    });
  }
}

/**
 * Android：原生相册 / 相机。iOS 未实现。
 */
export async function pickImage(source: ImagePickSource): Promise<PickedImage> {
  if (Platform.OS !== 'android') {
    throw Object.assign(new Error('当前仅支持 Android 与网页选图'), {
      name: 'UnsupportedError',
    });
  }
  if (source === 'camera') {
    await requestCameraPermission();
  }

  try {
    const result = await requireNative().pick(source);
    return {
      file: {
        uri: result.uri,
        type: result.type || 'image/jpeg',
        name: result.name || `archive-${Date.now()}.jpg`,
      },
      name: result.name || `archive-${Date.now()}.jpg`,
      mimeType: result.type || 'image/jpeg',
    };
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as {code?: string}).code)
        : '';
    if (code === 'cancelled' || isImagePickCancelled(error)) {
      throw new ImagePickCancelled();
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('无法打开相机或相册');
  }
}
