export type MapTextItem = {
  text: string;
  x: number;
  y: number;
  mapMarkerType: MapMarkerType;
  hex: string;
};

export type MapMarkerType = "Minor" | "Major";
