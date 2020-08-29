import v4 from "uuid/v4";
import { RawRect } from "./geom";

export interface Rect extends RawRect {
  id: string;
  parentRectId: string | undefined;
}

export function mkid() {
  return v4();
}
