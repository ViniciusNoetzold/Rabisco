/** Abrir: imagens e arquivos com camadas (.rabisco, OpenRaster, Photoshop). */
export const TIPOS_ABRIR =
  '.rabisco,.ora,.psd,.png,.jpeg,.jpg,.bmp,.gif,.webp,.ico,image/png,image/jpeg,image/bmp,image/gif,image/webp,image/x-icon,image/vnd.microsoft.icon,image/openraster,image/vnd.adobe.photoshop';

export const TIPOS_IMAGEM =
  '.png,.jpeg,.jpg,.bmp,.gif,.webp,.ico,image/png,image/jpeg,image/bmp,image/gif,image/webp,image/x-icon,image/vnd.microsoft.icon';

/** Que tipo de arquivo de camadas é este? (pelo conteúdo, não pela extensão). */
export function identificarArquivoDeCamadas(bytes: Uint8Array): 'zip' | 'psd' | null {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return 'zip';
  if (bytes[0] === 0x38 && bytes[1] === 0x42 && bytes[2] === 0x50 && bytes[3] === 0x53)
    return 'psd';
  return null;
}
