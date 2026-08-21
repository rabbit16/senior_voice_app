export type ImagePickSource = 'camera' | 'album';

export type PickedImage = {
  file: Blob | {uri: string; type: string; name: string};
  name: string;
  mimeType: string;
};

export class ImagePickCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'ImagePickCancelled';
  }
}

export function isImagePickCancelled(error: unknown): boolean {
  return (
    error instanceof ImagePickCancelled ||
    (error instanceof Error &&
      (error.name === 'ImagePickCancelled' || error.name === 'cancelled'))
  );
}
