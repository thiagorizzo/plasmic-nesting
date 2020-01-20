import v4 from "uuid/v4";
import { RawRect } from "./geom";

export interface Rect extends RawRect {
  readonly id: string;
}

export function mkid() {
  return v4();
}
