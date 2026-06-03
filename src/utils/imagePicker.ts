import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

export interface PickedImage {
  base64: string;
  uri: string;
}

async function assetToPickedImage(asset: ImagePicker.ImagePickerAsset): Promise<PickedImage> {
  const base64 =
    asset.base64 ??
    (await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    }));

  return {
    base64,
    uri: asset.uri,
  };
}

export async function pickImage(): Promise<PickedImage | null> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      console.error('Permission to access media library was denied');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      base64: true,
      quality: 0.8,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      shouldDownloadFromNetwork: true,
    });

    if (result.canceled || !result.assets?.[0]) {
      return null;
    }

    return await assetToPickedImage(result.assets[0]);
  } catch (error) {
    console.error('Error picking image:', error);
    return null;
  }
}

export async function takePhoto(): Promise<PickedImage | null> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      console.error('Permission to access camera was denied');
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      base64: true,
      quality: 0.8,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });

    if (result.canceled || !result.assets?.[0]) {
      return null;
    }

    return await assetToPickedImage(result.assets[0]);
  } catch (error) {
    console.error('Error taking photo:', error);
    return null;
  }
}
