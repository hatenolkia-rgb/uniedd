import type { IconType } from "react-icons";
import { FaGuitar, FaMicrophoneAlt, FaChessKnight, FaBullhorn } from "react-icons/fa";
import { GiPianoKeys, GiDrum, GiBallerinaShoes } from "react-icons/gi";
import type { ProgramName } from "./programs";

export const PROGRAM_ICONS: Record<ProgramName, IconType> = {
  Guitar: FaGuitar,
  Keyboard: GiPianoKeys,
  Vocals: FaMicrophoneAlt,
  Tabla: GiDrum,
  Dance: GiBallerinaShoes,
  "Public Speaking": FaBullhorn,
  Chess: FaChessKnight,
};
