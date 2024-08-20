import { MapItem } from "./map-item";
import { MapTextItem } from "./map-text-item";

export type StaticMap = {
  regionId: number;
  scorchedVictoryTowns: number;
  mapItems: MapItem[];
  mapItemsC: any[];
  mapItemsW: any[];
  mapTextItems: MapTextItem[];
  lastUpdated: number;
  version: number;
};
