import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Alert, Linking } from 'react-native';

export interface PickedImage {
  base64: string;
  mimeType: string;
  uri: string;
  analysisImages?: AnalysisImage[];
}

export interface AnalysisImage {
  base64: string;
  mimeType: string;
  label: string;
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

  try {
    const manipulated = await ImageManipulator.manipulateAsync(
      asset.uri,
      resize ? [{ resize }] : [],
      {
        base64: true,
        compress: 0.92,
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

    const pickedImage = {
      base64,
      mimeType: 'image/jpeg',
      uri: manipulated.uri,
    };

    return {
      ...pickedImage,
      analysisImages: await createAnalysisImages(asset, pickedImage),
    };
  } catch (error) {
    console.warn('Image manipulation failed. Falling back to original asset.', error);
  }

  const base64 =
    asset.base64 ??
    (await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    }));

  if (!base64) {
    throw new Error('画像をAI解析用データに変換できませんでした');
  }

  return {
    base64,
    mimeType: asset.mimeType || 'image/jpeg',
    uri: asset.uri,
    analysisImages: [],
  };
}

async function createAnalysisImages(
  asset: ImagePicker.ImagePickerAsset,
  primary: PickedImage
): Promise<AnalysisImage[]> {
  const width = asset.width || 0;
  const height = asset.height || 0;
  if (!width || !height) {
    return [];
  }

  const cropSpecs = [
    {
      label: 'web-pitch-only',
      originX: Math.round(width * 0.08),
      originY: Math.round(height * 0.14),
      width: Math.round(width * 0.58),
      height: Math.round(height * 0.76),
      enabled: width > height * 1.25,
    },
    {
      label: 'left-main-area',
      originX: 0,
      originY: 0,
      width: Math.round(width * 0.72),
      height,
      enabled: width > height * 1.15,
    },
    {
      label: 'center-pitch-zoom',
      originX: Math.round(width * 0.08),
      originY: Math.round(height * 0.08),
      width: Math.round(width * 0.84),
      height: Math.round(height * 0.84),
      enabled: true,
    },
    {
      label: 'upper-line-zoom',
      originX: 0,
      originY: 0,
      width,
      height: Math.round(height * 0.55),
      enabled: height > width * 1.05,
    },
    {
      label: 'lower-line-zoom',
      originX: 0,
      originY: Math.round(height * 0.45),
      width,
      height: Math.round(height * 0.55),
      enabled: height > width * 1.05,
    },
  ];

  const variants: AnalysisImage[] = [
    {
      base64: primary.base64,
      mimeType: primary.mimeType,
      label: 'full-selection',
    },
  ];

  for (const spec of cropSpecs) {
    if (!spec.enabled || variants.length >= 5) {
      continue;
    }

    try {
      const cropped = await ImageManipulator.manipulateAsync(
        asset.uri,
        [
          {
            crop: {
              originX: Math.max(0, spec.originX),
              originY: Math.max(0, spec.originY),
              width: Math.min(width - spec.originX, spec.width),
              height: Math.min(height - spec.originY, spec.height),
            },
          },
          {
            resize: {
              width: 2600,
            },
          },
        ],
        {
          base64: true,
          compress: 0.96,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      if (cropped.base64) {
        variants.push({
          base64: cropped.base64,
          mimeType: 'image/jpeg',
          label: spec.label,
        });
      }
    } catch (error) {
      console.warn(`Failed to create analysis image: ${spec.label}`, error);
    }
  }

  return variants;
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
      allowsEditing: true,
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
      allowsEditing: true,
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
