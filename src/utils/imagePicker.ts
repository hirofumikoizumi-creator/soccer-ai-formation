import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Alert, Linking } from 'react-native';

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
