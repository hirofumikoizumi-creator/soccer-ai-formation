import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Alert, Linking } from 'react-native';

export interface PickedImage {
  base64: string;
  mimeType: string;
  uri: string;
}

async function assetToPickedImage(asset: ImagePicker.ImagePickerAsset): Promise<PickedImage> {
  const maxDimension = Math.max(asset.width || 0, asset.height || 0);
  const targetMaxDimension = 3200;
  const resize =
    maxDimension > targetMaxDimension
      ? {
          width:
            (asset.width || 0) >= (asset.height || 0)
              ? targetMaxDimension
              : Math.round(((asset.width || 1) / (asset.height || 1)) * targetMaxDimension),
        }
      : undefined;

  const manipulated = await ImageManipulator.manipulateAsync(
    asset.uri,
    resize ? [{ resize }] : [],
    {
      base64: true,
      compress: 0.98,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  const base64 =
    manipulated.base64 ??
    (await FileSystem.readAsStringAsync(manipulated.uri, {
      encoding: FileSystem.EncodingType.Base64,
    }));

  if (!base64) {
    throw new Error('画像をAI解析用データに変換できませんでした');
  }

  return {
    base64,
    mimeType: 'image/jpeg',
    uri: manipulated.uri,
  };
}

function showSettingsAlert(title: string, message: string) {
  Alert.alert(title, message, [
    { text: 'キャンセル', style: 'cancel' },
    {
      text: '設定を開く',
      onPress: () => {
        Linking.openSettings().catch((error) => {
          console.error('Error opening settings:', error);
        });
      },
    },
  ]);
}

export async function pickImage(): Promise<PickedImage | null> {
  try {
    const currentPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
    const permission = currentPermission.granted
      ? currentPermission
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      console.error('Permission to access media library was denied');
      if (!permission.canAskAgain) {
        showSettingsAlert(
          '写真へのアクセスが必要です',
          'iPhoneの設定で写真へのアクセスを許可してください。'
        );
      }
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      base64: true,
      quality: 1,
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
    const currentPermission = await ImagePicker.getCameraPermissionsAsync();
    const permission = currentPermission.granted
      ? currentPermission
      : await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      console.error('Permission to access camera was denied');
      if (!permission.canAskAgain) {
        showSettingsAlert(
          'カメラへのアクセスが必要です',
          'iPhoneの設定でカメラへのアクセスを許可してください。'
        );
      }
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      base64: true,
      quality: 1,
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
