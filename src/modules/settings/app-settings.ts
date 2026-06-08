/**
 * Runtime, admin-editable application settings. These are stored as key/value
 * rows in `app_settings` and merged over the defaults below. They control
 * client behaviour (e.g. the home slider) and surface the media limits to the
 * dashboard. Server-side hard ceilings (DTO validation, byte limits) remain the
 * authoritative safety bounds; these values may only tighten within them.
 */
export interface AppSettings {
  sliderEnabled: boolean;
  maxListingImages: number;
  maxListingVideos: number;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  sliderEnabled: true,
  maxListingImages: 15,
  maxListingVideos: 1
};

export const APP_SETTING_KEYS = Object.keys(DEFAULT_APP_SETTINGS) as Array<keyof AppSettings>;
